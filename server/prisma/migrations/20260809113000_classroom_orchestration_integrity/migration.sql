-- D2-C Classroom Orchestration — relational/runtime integrity hardening.
-- Service-level validation is intentionally duplicated at the database boundary so
-- direct SQL cannot forge cross-tenant participants, stale semantic events or
-- mismatched learning evidence.

CREATE OR REPLACE FUNCTION live_session_participant_integrity_guard() RETURNS trigger AS $$
DECLARE
  session_org TEXT;
  group_session TEXT;
  member_org TEXT;
  student_role_active BOOLEAN;
BEGIN
  SELECT "organization_id" INTO session_org
  FROM "live_sessions"
  WHERE "live_session_id" = NEW."live_session_id";

  IF session_org IS NULL THEN
    RAISE EXCEPTION 'LIVE_PARTICIPANT_SESSION_NOT_FOUND';
  END IF;

  IF NEW."live_session_group_id" IS NOT NULL THEN
    SELECT "live_session_id" INTO group_session
    FROM "live_session_groups"
    WHERE "live_session_group_id" = NEW."live_session_group_id";

    IF group_session IS NULL OR group_session IS DISTINCT FROM NEW."live_session_id" THEN
      RAISE EXCEPTION 'LIVE_PARTICIPANT_GROUP_SESSION_MISMATCH';
    END IF;
  END IF;

  IF NEW."membership_id" IS NOT NULL THEN
    SELECT m."organization_id",
           (
             m."role" = 'STUDENT' OR EXISTS (
               SELECT 1
               FROM "membership_role_assignments" mra
               WHERE mra."membership_id" = m."membership_id"
                 AND mra."role" = 'STUDENT'
                 AND mra."deleted_at" IS NULL
             )
           )
      INTO member_org, student_role_active
    FROM "memberships" m
    WHERE m."membership_id" = NEW."membership_id"
      AND m."deleted_at" IS NULL;

    IF member_org IS NULL OR member_org IS DISTINCT FROM session_org THEN
      RAISE EXCEPTION 'LIVE_PARTICIPANT_TENANT_MISMATCH';
    END IF;
    IF NOT COALESCE(student_role_active, false) THEN
      RAISE EXCEPTION 'LIVE_PARTICIPANT_STUDENT_ROLE_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_session_participant_integrity_guard_trigger ON "live_session_participants";
CREATE TRIGGER live_session_participant_integrity_guard_trigger
BEFORE INSERT OR UPDATE OF "live_session_id", "live_session_group_id", "membership_id"
ON "live_session_participants"
FOR EACH ROW EXECUTE FUNCTION live_session_participant_integrity_guard();

CREATE OR REPLACE FUNCTION live_semantic_event_integrity_guard() RETURNS trigger AS $$
DECLARE
  session_source TEXT;
  session_status TEXT;
  session_revision INTEGER;
  current_stage TEXT;
  lesson_version TEXT;
  stage_version TEXT;
  participant_session TEXT;
BEGIN
  SELECT "source_kind"::text,
         "status"::text,
         "state_revision",
         "current_lesson_stage_id",
         "lesson_experience_version_id"
    INTO session_source, session_status, session_revision, current_stage, lesson_version
  FROM "live_sessions"
  WHERE "live_session_id" = NEW."live_session_id";

  IF session_source IS NULL THEN
    RAISE EXCEPTION 'LIVE_EVENT_SESSION_NOT_FOUND';
  END IF;
  IF session_source <> 'LESSON_EXPERIENCE' THEN
    RAISE EXCEPTION 'LIVE_EVENT_LESSON_SESSION_REQUIRED';
  END IF;
  IF session_status <> 'RUNNING' THEN
    RAISE EXCEPTION 'LIVE_EVENT_SESSION_NOT_RUNNING';
  END IF;
  IF current_stage IS DISTINCT FROM NEW."lesson_stage_id" THEN
    RAISE EXCEPTION 'LIVE_EVENT_STAGE_NOT_CURRENT';
  END IF;
  IF session_revision IS DISTINCT FROM NEW."session_revision" THEN
    RAISE EXCEPTION 'LIVE_EVENT_REVISION_MISMATCH';
  END IF;

  SELECT "lesson_experience_version_id" INTO stage_version
  FROM "lesson_stages"
  WHERE "lesson_stage_id" = NEW."lesson_stage_id";

  IF stage_version IS NULL OR stage_version IS DISTINCT FROM lesson_version THEN
    RAISE EXCEPTION 'LIVE_EVENT_STAGE_VERSION_MISMATCH';
  END IF;

  IF NEW."live_session_participant_id" IS NOT NULL THEN
    SELECT "live_session_id" INTO participant_session
    FROM "live_session_participants"
    WHERE "live_session_participant_id" = NEW."live_session_participant_id";

    IF participant_session IS NULL OR participant_session IS DISTINCT FROM NEW."live_session_id" THEN
      RAISE EXCEPTION 'LIVE_EVENT_PARTICIPANT_SESSION_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_semantic_event_integrity_guard_trigger ON "live_semantic_events";
CREATE TRIGGER live_semantic_event_integrity_guard_trigger
BEFORE INSERT ON "live_semantic_events"
FOR EACH ROW EXECUTE FUNCTION live_semantic_event_integrity_guard();

CREATE OR REPLACE FUNCTION live_learning_evidence_integrity_guard() RETURNS trigger AS $$
DECLARE
  event_session TEXT;
  event_participant TEXT;
  event_stage TEXT;
  event_type TEXT;
BEGIN
  SELECT "live_session_id",
         "live_session_participant_id",
         "lesson_stage_id",
         "event_type"
    INTO event_session, event_participant, event_stage, event_type
  FROM "live_semantic_events"
  WHERE "live_semantic_event_id" = NEW."source_event_id";

  IF event_session IS NULL THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_SOURCE_EVENT_NOT_FOUND';
  END IF;
  IF event_session IS DISTINCT FROM NEW."live_session_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_SESSION_MISMATCH';
  END IF;
  IF event_stage IS DISTINCT FROM NEW."lesson_stage_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_STAGE_MISMATCH';
  END IF;
  IF event_participant IS DISTINCT FROM NEW."live_session_participant_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_PARTICIPANT_MISMATCH';
  END IF;
  IF event_type IS DISTINCT FROM NEW."evidence_type" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_TYPE_MISMATCH';
  END IF;
  IF NEW."completion_is_mastery" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_COMPLETION_IS_NOT_MASTERY';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_learning_evidence_integrity_guard_trigger ON "live_learning_evidence";
CREATE TRIGGER live_learning_evidence_integrity_guard_trigger
BEFORE INSERT ON "live_learning_evidence"
FOR EACH ROW EXECUTE FUNCTION live_learning_evidence_integrity_guard();

CREATE OR REPLACE FUNCTION live_session_command_integrity_guard() RETURNS trigger AS $$
DECLARE
  session_org TEXT;
  session_revision INTEGER;
  session_status TEXT;
  session_stage TEXT;
  actor_org TEXT;
  actor_authorized BOOLEAN;
BEGIN
  SELECT "organization_id", "state_revision", "status"::text, "current_lesson_stage_id"
    INTO session_org, session_revision, session_status, session_stage
  FROM "live_sessions"
  WHERE "live_session_id" = NEW."live_session_id";

  IF session_org IS NULL THEN
    RAISE EXCEPTION 'LIVE_COMMAND_SESSION_NOT_FOUND';
  END IF;

  SELECT m."organization_id",
         (
           m."role" IN ('TEACHER', 'DIRECTOR', 'OWNER') OR EXISTS (
             SELECT 1
             FROM "membership_role_assignments" mra
             WHERE mra."membership_id" = m."membership_id"
               AND mra."role" IN ('TEACHER', 'DIRECTOR', 'OWNER')
               AND mra."deleted_at" IS NULL
           )
         )
    INTO actor_org, actor_authorized
  FROM "memberships" m
  WHERE m."membership_id" = NEW."actor_membership_id"
    AND m."deleted_at" IS NULL;

  IF actor_org IS NULL OR actor_org IS DISTINCT FROM session_org THEN
    RAISE EXCEPTION 'LIVE_COMMAND_ACTOR_TENANT_MISMATCH';
  END IF;
  IF NOT COALESCE(actor_authorized, false) THEN
    RAISE EXCEPTION 'LIVE_COMMAND_TEACHER_ROLE_REQUIRED';
  END IF;
  IF NEW."resulting_revision" IS DISTINCT FROM session_revision THEN
    RAISE EXCEPTION 'LIVE_COMMAND_RESULT_REVISION_MISMATCH';
  END IF;
  IF NEW."expected_revision" IS NOT NULL
     AND NEW."expected_revision" IS DISTINCT FROM NEW."resulting_revision" - 1 THEN
    RAISE EXCEPTION 'LIVE_COMMAND_EXPECTED_REVISION_MISMATCH';
  END IF;
  IF NEW."to_status"::text IS DISTINCT FROM session_status THEN
    RAISE EXCEPTION 'LIVE_COMMAND_RESULT_STATUS_MISMATCH';
  END IF;
  IF NEW."to_stage_id" IS DISTINCT FROM session_stage THEN
    RAISE EXCEPTION 'LIVE_COMMAND_RESULT_STAGE_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_session_command_integrity_guard_trigger ON "live_session_commands";
CREATE TRIGGER live_session_command_integrity_guard_trigger
BEFORE INSERT ON "live_session_commands"
FOR EACH ROW EXECUTE FUNCTION live_session_command_integrity_guard();
