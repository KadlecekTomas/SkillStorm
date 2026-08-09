-- Interactive Curriculum D2-B — immutable Lesson Experience definition layer.
-- Additive only. Runtime classroom orchestration arrives in a later D2 step.

CREATE TYPE "LessonExperienceScope" AS ENUM ('GLOBAL', 'ORGANIZATION');
CREATE TYPE "LessonExperienceVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED');
CREATE TYPE "LessonStageType" AS ENUM (
  'HOOK',
  'PREDICTION',
  'EXPLORATION',
  'DISCOVERY',
  'TEACHER_INTERVENTION',
  'CHALLENGE',
  'REFLECTION',
  'EVIDENCE'
);
CREATE TYPE "LessonStageCompletionType" AS ENUM ('MANUAL', 'ACTIVITY', 'CHECKPOINT');
CREATE TYPE "LessonExperienceCurriculumMappingType" AS ENUM ('PRIMARY', 'SUPPORTING', 'RELATED');
CREATE TYPE "LessonExperienceCurriculumMappingStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'STALE');

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'LESSON_EXPERIENCE';

CREATE TABLE "lesson_experiences" (
  "lesson_experience_id" TEXT NOT NULL,
  "scope" "LessonExperienceScope" NOT NULL,
  "organization_id" TEXT,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "description" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "lesson_experiences_pkey" PRIMARY KEY ("lesson_experience_id"),
  CONSTRAINT "lesson_experience_scope_organization_check" CHECK (
    ("scope" = 'GLOBAL' AND "organization_id" IS NULL)
    OR ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
  )
);

CREATE TABLE "lesson_experience_versions" (
  "lesson_experience_version_id" TEXT NOT NULL,
  "lesson_experience_id" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL,
  "status" "LessonExperienceVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "title" VARCHAR(300) NOT NULL,
  "summary" TEXT,
  "learning_objective" TEXT NOT NULL,
  "pedagogical_rationale" TEXT NOT NULL,
  "supported_modes" "ActivityDeliveryMode"[] NOT NULL,
  "recommended_mode" "ActivityDeliveryMode" NOT NULL,
  "estimated_duration_min" INTEGER NOT NULL,
  "teacher_plan_json" JSONB NOT NULL,
  "hardware_requirements_json" JSONB NOT NULL,
  "accessibility_plan_json" JSONB NOT NULL,
  "privacy_plan_json" JSONB NOT NULL,
  "offline_policy_json" JSONB NOT NULL,
  "asset_manifest_json" JSONB NOT NULL,
  "content_checksum" CHAR(64),
  "sealed_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "published_at" TIMESTAMP(3),
  "published_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lesson_experience_versions_pkey" PRIMARY KEY ("lesson_experience_version_id"),
  CONSTRAINT "lesson_experience_version_number_check" CHECK ("version_no" >= 1),
  CONSTRAINT "lesson_experience_version_schema_check" CHECK ("schema_version" >= 1),
  CONSTRAINT "lesson_experience_version_duration_check" CHECK ("estimated_duration_min" BETWEEN 1 AND 240),
  CONSTRAINT "lesson_experience_version_modes_check" CHECK (cardinality("supported_modes") >= 1),
  CONSTRAINT "lesson_experience_version_recommended_mode_check" CHECK ("recommended_mode" = ANY("supported_modes")),
  CONSTRAINT "lesson_experience_version_seal_check" CHECK (
    ("sealed_at" IS NULL AND "content_checksum" IS NULL AND "status" = 'DRAFT')
    OR ("sealed_at" IS NOT NULL AND "content_checksum" IS NOT NULL)
  ),
  CONSTRAINT "lesson_experience_version_lifecycle_metadata_check" CHECK (
    ("status" = 'DRAFT' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL AND "published_at" IS NULL AND "published_by" IS NULL)
    OR ("status" = 'REVIEW' AND "sealed_at" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "published_at" IS NULL AND "published_by" IS NULL)
    OR ("status" IN ('PUBLISHED', 'RETIRED') AND "sealed_at" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "published_at" IS NOT NULL AND "published_by" IS NOT NULL)
  )
);

CREATE TABLE "lesson_stages" (
  "lesson_stage_id" TEXT NOT NULL,
  "lesson_experience_version_id" TEXT NOT NULL,
  "stage_key" VARCHAR(120) NOT NULL,
  "order_index" INTEGER NOT NULL,
  "stage_type" "LessonStageType" NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "student_prompt" TEXT,
  "teacher_guidance" TEXT,
  "duration_min" INTEGER NOT NULL,
  "activity_version_id" TEXT,
  "completion_type" "LessonStageCompletionType" NOT NULL DEFAULT 'MANUAL',
  "checkpoint" BOOLEAN NOT NULL DEFAULT false,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "teacher_intervention" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_stages_pkey" PRIMARY KEY ("lesson_stage_id"),
  CONSTRAINT "lesson_stage_order_check" CHECK ("order_index" >= 0),
  CONSTRAINT "lesson_stage_duration_check" CHECK ("duration_min" BETWEEN 1 AND 120),
  CONSTRAINT "lesson_stage_activity_completion_check" CHECK (
    "completion_type" <> 'ACTIVITY' OR "activity_version_id" IS NOT NULL
  ),
  CONSTRAINT "lesson_stage_checkpoint_completion_check" CHECK (
    "completion_type" <> 'CHECKPOINT' OR "checkpoint" = true
  ),
  CONSTRAINT "lesson_stage_intervention_type_check" CHECK (
    "stage_type" <> 'TEACHER_INTERVENTION' OR "teacher_intervention" = true
  )
);

CREATE TABLE "lesson_experience_curriculum_mappings" (
  "lesson_experience_curriculum_mapping_id" TEXT NOT NULL,
  "lesson_experience_version_id" TEXT NOT NULL,
  "framework_outcome_id" TEXT NOT NULL,
  "outcome_aspect_id" TEXT,
  "mapping_type" "LessonExperienceCurriculumMappingType" NOT NULL,
  "status" "LessonExperienceCurriculumMappingStatus" NOT NULL DEFAULT 'PROPOSED',
  "rationale" TEXT NOT NULL,
  "proposed_by_type" "MappingProposerType" NOT NULL DEFAULT 'HUMAN',
  "proposed_by_id" TEXT,
  "review_rationale" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "framework_release_id" TEXT NOT NULL,
  "framework_outcome_checksum" CHAR(64) NOT NULL,
  "outcome_aspect_review_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lesson_experience_curriculum_mappings_pkey" PRIMARY KEY ("lesson_experience_curriculum_mapping_id"),
  CONSTRAINT "lesson_experience_mapping_review_check" CHECK (
    ("status" = 'PROPOSED' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL AND "review_rationale" IS NULL)
    OR ("status" IN ('APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)
    OR "status" = 'STALE'
  )
);

CREATE INDEX "lesson_experiences_org_scope_deleted_idx" ON "lesson_experiences"("organization_id", "scope", "deleted_at");
CREATE INDEX "lesson_experiences_scope_deleted_idx" ON "lesson_experiences"("scope", "deleted_at");
CREATE UNIQUE INDEX "lesson_experiences_global_slug_live_key" ON "lesson_experiences"("slug") WHERE "scope" = 'GLOBAL' AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "lesson_experiences_org_slug_live_key" ON "lesson_experiences"("organization_id", "slug") WHERE "scope" = 'ORGANIZATION' AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "lesson_experience_versions_number_key" ON "lesson_experience_versions"("lesson_experience_id", "version_no");
CREATE UNIQUE INDEX "lesson_experience_versions_checksum_key" ON "lesson_experience_versions"("lesson_experience_id", "content_checksum") WHERE "content_checksum" IS NOT NULL;
CREATE INDEX "lesson_experience_versions_status_idx" ON "lesson_experience_versions"("lesson_experience_id", "status");
CREATE INDEX "lesson_experience_versions_published_idx" ON "lesson_experience_versions"("status", "published_at");

CREATE UNIQUE INDEX "lesson_stages_key_key" ON "lesson_stages"("lesson_experience_version_id", "stage_key");
CREATE UNIQUE INDEX "lesson_stages_order_key" ON "lesson_stages"("lesson_experience_version_id", "order_index");
CREATE INDEX "lesson_stages_activity_version_idx" ON "lesson_stages"("activity_version_id");

CREATE INDEX "lesson_mapping_version_status_idx" ON "lesson_experience_curriculum_mappings"("lesson_experience_version_id", "status");
CREATE INDEX "lesson_mapping_outcome_status_idx" ON "lesson_experience_curriculum_mappings"("framework_outcome_id", "status");
CREATE INDEX "lesson_mapping_aspect_status_idx" ON "lesson_experience_curriculum_mappings"("outcome_aspect_id", "status");
CREATE INDEX "lesson_mapping_release_idx" ON "lesson_experience_curriculum_mappings"("framework_release_id");
CREATE UNIQUE INDEX "lesson_mapping_live_outcome_key" ON "lesson_experience_curriculum_mappings"("lesson_experience_version_id", "framework_outcome_id") WHERE "outcome_aspect_id" IS NULL AND "status" IN ('PROPOSED', 'APPROVED');
CREATE UNIQUE INDEX "lesson_mapping_live_aspect_key" ON "lesson_experience_curriculum_mappings"("lesson_experience_version_id", "framework_outcome_id", "outcome_aspect_id") WHERE "outcome_aspect_id" IS NOT NULL AND "status" IN ('PROPOSED', 'APPROVED');

ALTER TABLE "lesson_experiences" ADD CONSTRAINT "lesson_experiences_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_experience_versions" ADD CONSTRAINT "lesson_experience_versions_experience_fkey"
  FOREIGN KEY ("lesson_experience_id") REFERENCES "lesson_experiences"("lesson_experience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_stages" ADD CONSTRAINT "lesson_stages_version_fkey"
  FOREIGN KEY ("lesson_experience_version_id") REFERENCES "lesson_experience_versions"("lesson_experience_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_stages" ADD CONSTRAINT "lesson_stages_activity_version_fkey"
  FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("activity_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_experience_curriculum_mappings" ADD CONSTRAINT "lesson_mapping_version_fkey"
  FOREIGN KEY ("lesson_experience_version_id") REFERENCES "lesson_experience_versions"("lesson_experience_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_experience_curriculum_mappings" ADD CONSTRAINT "lesson_mapping_outcome_fkey"
  FOREIGN KEY ("framework_outcome_id") REFERENCES "framework_outcomes"("framework_outcome_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_experience_curriculum_mappings" ADD CONSTRAINT "lesson_mapping_aspect_fkey"
  FOREIGN KEY ("outcome_aspect_id") REFERENCES "outcome_aspects"("outcome_aspect_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_experience_curriculum_mappings" ADD CONSTRAINT "lesson_mapping_release_fkey"
  FOREIGN KEY ("framework_release_id") REFERENCES "curriculum_framework_releases"("curriculum_framework_release_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION lesson_experience_stage_guard()
RETURNS trigger AS $$
DECLARE
  parent_status "LessonExperienceVersionStatus";
  parent_sealed TIMESTAMP(3);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'LESSON_STAGE_IMMUTABLE';
  END IF;

  SELECT "status", "sealed_at"
    INTO parent_status, parent_sealed
    FROM "lesson_experience_versions"
    WHERE "lesson_experience_version_id" = NEW."lesson_experience_version_id";

  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'LESSON_STAGE_PARENT_NOT_FOUND';
  END IF;
  IF parent_status <> 'DRAFT' OR parent_sealed IS NOT NULL THEN
    RAISE EXCEPTION 'LESSON_STAGE_PARENT_SEALED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lesson_experience_stage_guard_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "lesson_stages"
FOR EACH ROW EXECUTE FUNCTION lesson_experience_stage_guard();

CREATE OR REPLACE FUNCTION lesson_experience_mapping_guard()
RETURNS trigger AS $$
DECLARE
  lesson_status "LessonExperienceVersionStatus";
  lesson_scope "LessonExperienceScope";
  lesson_org TEXT;
  outcome_release TEXT;
  outcome_checksum CHAR(64);
  aspect_outcome TEXT;
  aspect_version INTEGER;
  aspect_status "OutcomeAspectStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LESSON_MAPPING_IMMUTABLE';
  END IF;

  SELECT lev."status", le."scope", le."organization_id"
    INTO lesson_status, lesson_scope, lesson_org
    FROM "lesson_experience_versions" lev
    JOIN "lesson_experiences" le ON le."lesson_experience_id" = lev."lesson_experience_id"
    WHERE lev."lesson_experience_version_id" = NEW."lesson_experience_version_id";

  IF lesson_status IS NULL THEN
    RAISE EXCEPTION 'LESSON_MAPPING_VERSION_NOT_FOUND';
  END IF;
  IF lesson_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'LESSON_MAPPING_VERSION_FROZEN';
  END IF;

  SELECT "framework_release_id", "checksum"
    INTO outcome_release, outcome_checksum
    FROM "framework_outcomes"
    WHERE "framework_outcome_id" = NEW."framework_outcome_id";

  IF outcome_release IS NULL OR outcome_release <> NEW."framework_release_id" THEN
    RAISE EXCEPTION 'LESSON_MAPPING_RELEASE_MISMATCH';
  END IF;
  IF outcome_checksum IS DISTINCT FROM NEW."framework_outcome_checksum" THEN
    RAISE EXCEPTION 'LESSON_MAPPING_OUTCOME_CHECKSUM_MISMATCH';
  END IF;

  IF NEW."outcome_aspect_id" IS NOT NULL THEN
    SELECT "framework_outcome_id", "review_version", "status"
      INTO aspect_outcome, aspect_version, aspect_status
      FROM "outcome_aspects"
      WHERE "outcome_aspect_id" = NEW."outcome_aspect_id";
    IF aspect_outcome IS NULL OR aspect_outcome <> NEW."framework_outcome_id" THEN
      RAISE EXCEPTION 'LESSON_MAPPING_ASPECT_OUTCOME_MISMATCH';
    END IF;
    IF aspect_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'LESSON_MAPPING_ASPECT_RETIRED';
    END IF;
    IF aspect_version IS DISTINCT FROM NEW."outcome_aspect_review_version" THEN
      RAISE EXCEPTION 'LESSON_MAPPING_ASPECT_VERSION_MISMATCH';
    END IF;
  ELSIF NEW."outcome_aspect_review_version" IS NOT NULL THEN
    RAISE EXCEPTION 'LESSON_MAPPING_ASPECT_VERSION_WITHOUT_ASPECT';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('REJECTED', 'STALE') THEN
      RAISE EXCEPTION 'LESSON_MAPPING_DECISION_IMMUTABLE';
    END IF;
    IF OLD."status" = 'APPROVED' AND NEW."status" <> 'STALE' THEN
      RAISE EXCEPTION 'LESSON_MAPPING_APPROVED_ONLY_TO_STALE';
    END IF;
    IF OLD."status" = 'PROPOSED' AND NEW."status" NOT IN ('APPROVED', 'REJECTED', 'STALE') THEN
      RAISE EXCEPTION 'LESSON_MAPPING_INVALID_TRANSITION';
    END IF;

    IF ROW(
      OLD."lesson_experience_version_id",
      OLD."framework_outcome_id",
      OLD."outcome_aspect_id",
      OLD."mapping_type",
      OLD."rationale",
      OLD."proposed_by_type",
      OLD."proposed_by_id",
      OLD."framework_release_id",
      OLD."framework_outcome_checksum",
      OLD."outcome_aspect_review_version",
      OLD."created_at"
    ) IS DISTINCT FROM ROW(
      NEW."lesson_experience_version_id",
      NEW."framework_outcome_id",
      NEW."outcome_aspect_id",
      NEW."mapping_type",
      NEW."rationale",
      NEW."proposed_by_type",
      NEW."proposed_by_id",
      NEW."framework_release_id",
      NEW."framework_outcome_checksum",
      NEW."outcome_aspect_review_version",
      NEW."created_at"
    ) THEN
      RAISE EXCEPTION 'LESSON_MAPPING_SNAPSHOT_IMMUTABLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lesson_experience_mapping_guard_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "lesson_experience_curriculum_mappings"
FOR EACH ROW EXECUTE FUNCTION lesson_experience_mapping_guard();

CREATE OR REPLACE FUNCTION lesson_experience_version_guard()
RETURNS trigger AS $$
DECLARE
  stage_count INTEGER;
  stage_duration INTEGER;
  bad_activity_count INTEGER;
  incompatible_mode_count INTEGER;
  cross_scope_count INTEGER;
  approved_mapping_count INTEGER;
  pending_mapping_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LESSON_EXPERIENCE_VERSION_IMMUTABLE';
  END IF;

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
    SELECT COUNT(*), COALESCE(SUM("duration_min"), 0)
      INTO stage_count, stage_duration
      FROM "lesson_stages"
      WHERE "lesson_experience_version_id" = NEW."lesson_experience_version_id";
    IF stage_count = 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_STAGE_REQUIRED';
    END IF;
    IF stage_duration > NEW."estimated_duration_min" THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_STAGE_DURATION_EXCEEDS_ESTIMATE';
    END IF;

    SELECT COUNT(*) INTO bad_activity_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av ON av."activity_version_id" = ls."activity_version_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND av."status" <> 'PUBLISHED';
    IF bad_activity_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_ACTIVITY_NOT_PUBLISHED';
    END IF;

    SELECT COUNT(*) INTO incompatible_mode_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av ON av."activity_version_id" = ls."activity_version_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND NOT (NEW."supported_modes" <@ av."supported_modes");
    IF incompatible_mode_count > 0 THEN
      RAISE EXCEPTION 'LESSON_EXPERIENCE_ACTIVITY_MODE_INCOMPATIBLE';
    END IF;

    SELECT COUNT(*) INTO cross_scope_count
      FROM "lesson_stages" ls
      JOIN "activity_versions" av ON av."activity_version_id" = ls."activity_version_id"
      JOIN "activities" a ON a."activity_id" = av."activity_id"
      JOIN "lesson_experiences" le ON le."lesson_experience_id" = NEW."lesson_experience_id"
      WHERE ls."lesson_experience_version_id" = NEW."lesson_experience_version_id"
        AND (
          (le."scope" = 'GLOBAL' AND a."scope" <> 'GLOBAL') OR
          (le."scope" = 'ORGANIZATION' AND a."scope" = 'ORGANIZATION' AND a."organization_id" IS DISTINCT FROM le."organization_id")
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lesson_experience_version_guard_trigger"
BEFORE UPDATE OR DELETE ON "lesson_experience_versions"
FOR EACH ROW EXECUTE FUNCTION lesson_experience_version_guard();
