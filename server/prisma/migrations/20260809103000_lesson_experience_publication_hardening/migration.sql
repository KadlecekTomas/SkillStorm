-- D2-B defense-in-depth: the service publication validator is authoritative for
-- user-facing errors, but direct SQL must not be able to publish a pedagogically
-- incomplete or provenance-stale LessonExperienceVersion either.

CREATE OR REPLACE FUNCTION lesson_experience_version_guard()
RETURNS trigger AS $$
DECLARE
  stage_count INTEGER;
  stage_duration INTEGER;
  activity_stage_count INTEGER;
  learner_action_count INTEGER;
  reflection_count INTEGER;
  evidence_count INTEGER;
  bad_activity_count INTEGER;
  incompatible_mode_count INTEGER;
  cross_scope_count INTEGER;
  approved_mapping_count INTEGER;
  pending_mapping_count INTEGER;
  stale_mapping_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_IMMUTABLE';
  END IF;

  -- The only content mutation ever allowed is the one-time DRAFT seal. Stages
  -- have already been inserted while the parent is unsealed; the application
  -- computes the canonical checksum over metadata + ordered stages and seals it.
  IF OLD."sealed_at" IS NULL THEN
    IF NEW."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_MUST_SEAL_BEFORE_REVIEW';
    END IF;
    IF NEW."sealed_at" IS NULL OR NEW."content_checksum" IS NULL THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_SEAL_REQUIRED';
    END IF;
    IF ROW(
      OLD."lesson_experience_id", OLD."version_no", OLD."schema_version",
      OLD."title", OLD."summary", OLD."learning_objective", OLD."pedagogical_rationale",
      OLD."supported_modes", OLD."recommended_mode", OLD."estimated_duration_min",
      OLD."teacher_plan_json", OLD."hardware_requirements_json", OLD."accessibility_plan_json",
      OLD."privacy_plan_json", OLD."offline_policy_json", OLD."asset_manifest_json",
      OLD."created_at"
    ) IS DISTINCT FROM ROW(
      NEW."lesson_experience_id", NEW."version_no", NEW."schema_version",
      NEW."title", NEW."summary", NEW."learning_objective", NEW."pedagogical_rationale",
      NEW."supported_modes", NEW."recommended_mode", NEW."estimated_duration_min",
      NEW."teacher_plan_json", NEW."hardware_requirements_json", NEW."accessibility_plan_json",
      NEW."privacy_plan_json", NEW."offline_policy_json", NEW."asset_manifest_json",
      NEW."created_at"
    ) THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_CONTENT_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
    OLD."lesson_experience_id", OLD."version_no", OLD."schema_version",
    OLD."title", OLD."summary", OLD."learning_objective", OLD."pedagogical_rationale",
    OLD."supported_modes", OLD."recommended_mode", OLD."estimated_duration_min",
    OLD."teacher_plan_json", OLD."hardware_requirements_json", OLD."accessibility_plan_json",
    OLD."privacy_plan_json", OLD."offline_policy_json", OLD."asset_manifest_json",
    OLD."content_checksum", OLD."sealed_at", OLD."created_at"
  ) IS DISTINCT FROM ROW(
    NEW."lesson_experience_id", NEW."version_no", NEW."schema_version",
    NEW."title", NEW."summary", NEW."learning_objective", NEW."pedagogical_rationale",
    NEW."supported_modes", NEW."recommended_mode", NEW."estimated_duration_min",
    NEW."teacher_plan_json", NEW."hardware_requirements_json", NEW."accessibility_plan_json",
    NEW."privacy_plan_json", NEW."offline_policy_json", NEW."asset_manifest_json",
    NEW."content_checksum", NEW."sealed_at", NEW."created_at"
  ) THEN
    RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_CONTENT_IMMUTABLE';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NOT (
      (OLD."status" = 'DRAFT' AND NEW."status" = 'REVIEW') OR
      (OLD."status" = 'REVIEW' AND NEW."status" = 'PUBLISHED') OR
      (OLD."status" = 'PUBLISHED' AND NEW."status" = 'RETIRED')
    ) THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_INVALID_TRANSITION';
    END IF;
  END IF;

  IF NEW."status" = 'PUBLISHED' AND OLD."status" <> 'PUBLISHED' THEN
    SELECT
      COUNT(*),
      COALESCE(SUM("duration_min"), 0),
      COUNT(*) FILTER (WHERE "activity_version_id" IS NOT NULL),
      COUNT(*) FILTER (
        WHERE "stage_type" IN ('PREDICTION', 'EXPLORATION', 'CHALLENGE')
      ),
      COUNT(*) FILTER (WHERE "stage_type" = 'REFLECTION'),
      COUNT(*) FILTER (WHERE "stage_type" = 'EVIDENCE')
      INTO
        stage_count,
        stage_duration,
        activity_stage_count,
        learner_action_count,
        reflection_count,
        evidence_count
      FROM "lesson_stages"
      WHERE "lesson_experience_version_id" = NEW."lesson_experience_version_id";

    IF stage_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_STAGE_REQUIRED';
    END IF;
    IF activity_stage_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_INTERACTIVE_STAGE_REQUIRED';
    END IF;
    IF learner_action_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_LEARNER_ACTION_REQUIRED';
    END IF;
    IF reflection_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_REFLECTION_REQUIRED';
    END IF;
    IF evidence_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_EVIDENCE_REQUIRED';
    END IF;
    IF stage_duration > NEW."estimated_duration_min" THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_STAGE_DURATION_EXCEEDS_ESTIMATE';
    END IF;

    SELECT COUNT(*) INTO bad_activity_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av
        ON av."activity_version_id" = ls."activity_version_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND av."status" <> 'PUBLISHED';
    IF bad_activity_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_ACTIVITY_NOT_PUBLISHED';
    END IF;

    -- A Lesson Experience that advertises a delivery mode must be executable
    -- through every Activity-backed stage in that same mode.
    SELECT COUNT(*) INTO incompatible_mode_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av
        ON av."activity_version_id" = ls."activity_version_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND NOT (NEW."supported_modes" <@ av."supported_modes");
    IF incompatible_mode_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_ACTIVITY_MODE_INCOMPATIBLE';
    END IF;

    -- Global lessons are commercially reusable platform content and therefore
    -- may only depend on global Activities. Organization lessons may combine
    -- global content with content from the same tenant, never another tenant.
    SELECT COUNT(*) INTO cross_scope_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av
        ON av."activity_version_id" = ls."activity_version_id"
      JOIN "activities" a
        ON a."activity_id" = av."activity_id"
      JOIN "lesson_experiences" le
        ON le."lesson_experience_id" = NEW."lesson_experience_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND (
          (le."scope" = 'GLOBAL' AND a."scope" <> 'GLOBAL') OR
          (
            le."scope" = 'ORGANIZATION'
            AND a."scope" = 'ORGANIZATION'
            AND a."organization_id" IS DISTINCT FROM le."organization_id"
          )
        );
    IF cross_scope_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_ACTIVITY_SCOPE_MISMATCH';
    END IF;

    SELECT COUNT(*) INTO approved_mapping_count
      FROM "lesson_experience_curriculum_mappings"
      WHERE "lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND "status" = 'APPROVED';
    IF approved_mapping_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_MAPPING_REQUIRED';
    END IF;

    SELECT COUNT(*) INTO pending_mapping_count
      FROM "lesson_experience_curriculum_mappings"
      WHERE "lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND "status" = 'PROPOSED';
    IF pending_mapping_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_MAPPING_REVIEW_PENDING';
    END IF;

    -- Approved mapping snapshots are not enough by themselves: publication
    -- requires the referenced canonical release/outcome/aspect to still match
    -- the reviewed provenance captured by the mapping.
    SELECT COUNT(*) INTO stale_mapping_count
      FROM "lesson_experience_curriculum_mappings" lm
      JOIN "curriculum_framework_releases" cfr
        ON cfr."curriculum_framework_release_id" = lm."framework_release_id"
      JOIN "framework_outcomes" fo
        ON fo."framework_outcome_id" = lm."framework_outcome_id"
      LEFT JOIN "outcome_aspects" oa
        ON oa."outcome_aspect_id" = lm."outcome_aspect_id"
      WHERE lm."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND lm."status" = 'APPROVED'
        AND (
          cfr."status" <> 'VERIFIED'
          OR fo."framework_release_id" <> lm."framework_release_id"
          OR fo."checksum" IS DISTINCT FROM lm."framework_outcome_checksum"
          OR (
            lm."outcome_aspect_id" IS NOT NULL
            AND (
              oa."outcome_aspect_id" IS NULL
              OR oa."framework_outcome_id" <> lm."framework_outcome_id"
              OR oa."status" <> 'ACTIVE'
              OR oa."review_version" IS DISTINCT FROM lm."outcome_aspect_review_version"
            )
          )
          OR (
            lm."outcome_aspect_id" IS NULL
            AND lm."outcome_aspect_review_version" IS NOT NULL
          )
        );
    IF stale_mapping_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_MAPPING_STALE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
