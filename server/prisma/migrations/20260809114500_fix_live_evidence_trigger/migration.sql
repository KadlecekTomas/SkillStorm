-- D2-C follow-up: disambiguate PL/pgSQL variables from live_semantic_events columns.
-- Do not rewrite the original migration; production history remains append-only.

CREATE OR REPLACE FUNCTION live_learning_evidence_integrity_guard() RETURNS trigger AS $$
DECLARE
  source_event_session TEXT;
  source_event_participant TEXT;
  source_event_stage TEXT;
  source_event_type TEXT;
BEGIN
  SELECT e."live_session_id",
         e."live_session_participant_id",
         e."lesson_stage_id",
         e."event_type"
    INTO source_event_session,
         source_event_participant,
         source_event_stage,
         source_event_type
  FROM "live_semantic_events" e
  WHERE e."live_semantic_event_id" = NEW."source_event_id";

  IF source_event_session IS NULL THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_SOURCE_EVENT_NOT_FOUND';
  END IF;
  IF source_event_session IS DISTINCT FROM NEW."live_session_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_SESSION_MISMATCH';
  END IF;
  IF source_event_stage IS DISTINCT FROM NEW."lesson_stage_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_STAGE_MISMATCH';
  END IF;
  IF source_event_participant IS DISTINCT FROM NEW."live_session_participant_id" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_PARTICIPANT_MISMATCH';
  END IF;
  IF source_event_type IS DISTINCT FROM NEW."evidence_type" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_TYPE_MISMATCH';
  END IF;
  IF NEW."completion_is_mastery" THEN
    RAISE EXCEPTION 'LIVE_EVIDENCE_COMPLETION_IS_NOT_MASTERY';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
