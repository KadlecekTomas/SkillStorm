-- D2-C Classroom Orchestration Foundation

ALTER TYPE "LiveSessionMode" ADD VALUE IF NOT EXISTS 'SHARED_DEVICES';
ALTER TYPE "LiveSessionMode" ADD VALUE IF NOT EXISTS 'HYBRID';
ALTER TYPE "LiveSessionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

CREATE TYPE "LiveSessionSourceKind" AS ENUM ('LEGACY_TEST', 'LESSON_EXPERIENCE');
CREATE TYPE "LiveSessionCommandType" AS ENUM ('START', 'PAUSE', 'RESUME', 'NEXT_STAGE', 'FINISH');
CREATE TYPE "LiveParticipantStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'LEFT');

ALTER TABLE "live_sessions"
  ALTER COLUMN "test_id" DROP NOT NULL,
  ADD COLUMN "lesson_experience_version_id" TEXT,
  ADD COLUMN "source_kind" "LiveSessionSourceKind" NOT NULL DEFAULT 'LEGACY_TEST',
  ADD COLUMN "current_lesson_stage_id" TEXT,
  ADD COLUMN "state_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paused_at" TIMESTAMP(3);

ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_exactly_one_source_check" CHECK (
    ("source_kind" = 'LEGACY_TEST' AND "test_id" IS NOT NULL AND "lesson_experience_version_id" IS NULL) OR
    ("source_kind" = 'LESSON_EXPERIENCE' AND "test_id" IS NULL AND "lesson_experience_version_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "live_sessions_revision_nonnegative_check" CHECK ("state_revision" >= 0);

ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_lesson_experience_version_id_fkey"
  FOREIGN KEY ("lesson_experience_version_id") REFERENCES "lesson_experience_versions"("lesson_experience_version_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "live_sessions_current_lesson_stage_id_fkey"
  FOREIGN KEY ("current_lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "live_sessions_lesson_experience_version_id_status_idx"
  ON "live_sessions"("lesson_experience_version_id", "status");

CREATE TABLE "live_session_groups" (
  "live_session_group_id" TEXT NOT NULL,
  "live_session_id" TEXT NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "order_index" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_session_groups_pkey" PRIMARY KEY ("live_session_group_id"),
  CONSTRAINT "live_session_groups_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "live_session_groups_order_nonnegative_check" CHECK ("order_index" >= 0)
);
CREATE UNIQUE INDEX "live_session_groups_live_session_id_order_index_key" ON "live_session_groups"("live_session_id", "order_index");
CREATE UNIQUE INDEX "live_session_groups_live_session_id_label_key" ON "live_session_groups"("live_session_id", "label");
CREATE INDEX "live_session_groups_live_session_id_idx" ON "live_session_groups"("live_session_id");

ALTER TABLE "live_session_participants"
  ADD COLUMN "live_session_group_id" TEXT,
  ADD COLUMN "status" "LiveParticipantStatus" NOT NULL DEFAULT 'CONNECTED',
  ADD COLUMN "disconnected_at" TIMESTAMP(3),
  ADD CONSTRAINT "live_session_participants_live_session_group_id_fkey" FOREIGN KEY ("live_session_group_id") REFERENCES "live_session_groups"("live_session_group_id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "live_session_participants_live_session_id_membership_id_key"
  ON "live_session_participants"("live_session_id", "membership_id");
CREATE INDEX "live_session_participants_live_session_id_status_idx" ON "live_session_participants"("live_session_id", "status");
CREATE INDEX "live_session_participants_live_session_group_id_idx" ON "live_session_participants"("live_session_group_id");

CREATE TABLE "live_session_commands" (
  "live_session_command_id" TEXT NOT NULL,
  "live_session_id" TEXT NOT NULL,
  "command_id" VARCHAR(100) NOT NULL,
  "type" "LiveSessionCommandType" NOT NULL,
  "actor_membership_id" TEXT NOT NULL,
  "expected_revision" INTEGER,
  "resulting_revision" INTEGER NOT NULL,
  "from_status" "LiveSessionStatus" NOT NULL,
  "to_status" "LiveSessionStatus" NOT NULL,
  "from_stage_id" TEXT,
  "to_stage_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_session_commands_pkey" PRIMARY KEY ("live_session_command_id"),
  CONSTRAINT "live_session_commands_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "live_session_commands_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("membership_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "live_session_commands_revisions_nonnegative_check" CHECK (("expected_revision" IS NULL OR "expected_revision" >= 0) AND "resulting_revision" >= 0)
);
CREATE UNIQUE INDEX "live_session_commands_live_session_id_command_id_key" ON "live_session_commands"("live_session_id", "command_id");
CREATE INDEX "live_session_commands_live_session_id_created_at_idx" ON "live_session_commands"("live_session_id", "created_at");

CREATE TABLE "live_semantic_events" (
  "live_semantic_event_id" TEXT NOT NULL,
  "live_session_id" TEXT NOT NULL,
  "live_session_participant_id" TEXT,
  "lesson_stage_id" TEXT NOT NULL,
  "event_id" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(80) NOT NULL,
  "payload" JSONB,
  "session_revision" INTEGER NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_semantic_events_pkey" PRIMARY KEY ("live_semantic_event_id"),
  CONSTRAINT "live_semantic_events_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "live_semantic_events_live_session_participant_id_fkey" FOREIGN KEY ("live_session_participant_id") REFERENCES "live_session_participants"("live_session_participant_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "live_semantic_events_lesson_stage_id_fkey" FOREIGN KEY ("lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "live_semantic_events_revision_nonnegative_check" CHECK ("session_revision" >= 0)
);
CREATE UNIQUE INDEX "live_semantic_events_live_session_id_event_id_key" ON "live_semantic_events"("live_session_id", "event_id");
CREATE INDEX "live_semantic_events_live_session_id_received_at_idx" ON "live_semantic_events"("live_session_id", "received_at");
CREATE INDEX "live_semantic_events_live_session_participant_id_received_at_idx" ON "live_semantic_events"("live_session_participant_id", "received_at");
CREATE INDEX "live_semantic_events_lesson_stage_id_idx" ON "live_semantic_events"("lesson_stage_id");

CREATE TABLE "live_learning_evidence" (
  "live_learning_evidence_id" TEXT NOT NULL,
  "live_session_id" TEXT NOT NULL,
  "live_session_participant_id" TEXT,
  "lesson_stage_id" TEXT NOT NULL,
  "source_event_id" TEXT NOT NULL,
  "evidence_type" VARCHAR(80) NOT NULL,
  "payload" JSONB,
  "completion_is_mastery" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_learning_evidence_pkey" PRIMARY KEY ("live_learning_evidence_id"),
  CONSTRAINT "live_learning_evidence_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "live_learning_evidence_live_session_participant_id_fkey" FOREIGN KEY ("live_session_participant_id") REFERENCES "live_session_participants"("live_session_participant_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "live_learning_evidence_lesson_stage_id_fkey" FOREIGN KEY ("lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "live_learning_evidence_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "live_semantic_events"("live_semantic_event_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "live_learning_evidence_completion_not_mastery_check" CHECK ("completion_is_mastery" = false)
);
CREATE UNIQUE INDEX "live_learning_evidence_source_event_id_key" ON "live_learning_evidence"("source_event_id");
CREATE INDEX "live_learning_evidence_live_session_id_created_at_idx" ON "live_learning_evidence"("live_session_id", "created_at");
CREATE INDEX "live_learning_evidence_live_session_participant_id_created_at_idx" ON "live_learning_evidence"("live_session_participant_id", "created_at");
CREATE INDEX "live_learning_evidence_lesson_stage_id_idx" ON "live_learning_evidence"("lesson_stage_id");

CREATE OR REPLACE FUNCTION live_session_source_guard() RETURNS trigger AS $$
DECLARE
  lesson_status TEXT;
  lesson_scope TEXT;
  lesson_org TEXT;
  lesson_modes TEXT[];
  stage_version TEXT;
BEGIN
  IF NEW."source_kind" = 'LEGACY_TEST' THEN
    IF NEW."test_id" IS NULL OR NEW."lesson_experience_version_id" IS NOT NULL THEN
      RAISE EXCEPTION 'LIVE_SESSION_SOURCE_INVALID';
    END IF;
    IF NEW."current_lesson_stage_id" IS NOT NULL THEN
      RAISE EXCEPTION 'LIVE_SESSION_LEGACY_STAGE_FORBIDDEN';
    END IF;
    RETURN NEW;
  END IF;

  SELECT lev."status"::text, le."scope"::text, le."organization_id", lev."supported_modes"::text[]
    INTO lesson_status, lesson_scope, lesson_org, lesson_modes
  FROM "lesson_experience_versions" lev
  JOIN "lesson_experiences" le ON le."lesson_experience_id" = lev."lesson_experience_id"
  WHERE lev."lesson_experience_version_id" = NEW."lesson_experience_version_id";

  IF lesson_status IS NULL THEN RAISE EXCEPTION 'LIVE_SESSION_LESSON_NOT_FOUND'; END IF;
  IF lesson_status <> 'PUBLISHED' THEN RAISE EXCEPTION 'LIVE_SESSION_LESSON_NOT_PUBLISHED'; END IF;
  IF lesson_scope = 'ORGANIZATION' AND lesson_org IS DISTINCT FROM NEW."organization_id" THEN
    RAISE EXCEPTION 'LIVE_SESSION_LESSON_TENANT_MISMATCH';
  END IF;
  IF NOT (NEW."mode"::text = ANY(lesson_modes)) THEN
    RAISE EXCEPTION 'LIVE_SESSION_MODE_UNSUPPORTED';
  END IF;

  IF NEW."current_lesson_stage_id" IS NOT NULL THEN
    SELECT "lesson_experience_version_id" INTO stage_version
    FROM "lesson_stages" WHERE "lesson_stage_id" = NEW."current_lesson_stage_id";
    IF stage_version IS DISTINCT FROM NEW."lesson_experience_version_id" THEN
      RAISE EXCEPTION 'LIVE_SESSION_STAGE_VERSION_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_session_source_guard_trigger
BEFORE INSERT OR UPDATE ON "live_sessions"
FOR EACH ROW EXECUTE FUNCTION live_session_source_guard();

CREATE OR REPLACE FUNCTION live_orchestration_history_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LIVE_ORCHESTRATION_HISTORY_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_session_commands_immutable
BEFORE UPDATE OR DELETE ON "live_session_commands"
FOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();
CREATE TRIGGER live_semantic_events_immutable
BEFORE UPDATE OR DELETE ON "live_semantic_events"
FOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();
CREATE TRIGGER live_learning_evidence_immutable
BEFORE UPDATE OR DELETE ON "live_learning_evidence"
FOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();
