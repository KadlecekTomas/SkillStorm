-- PART 2: DB-level immutability of responses once submission is submitted
-- Trigger: block INSERT/UPDATE/DELETE on responses when parent submission has submitted_at set

CREATE OR REPLACE FUNCTION responses_submission_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF EXISTS (SELECT 1 FROM submissions WHERE submission_id = NEW.submission_id AND submitted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'SUBMISSION_LOCKED' USING ERRCODE = 'P0001';
    END IF;
  ELSIF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    IF EXISTS (SELECT 1 FROM submissions WHERE submission_id = COALESCE(NEW.submission_id, OLD.submission_id) AND submitted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'SUBMISSION_LOCKED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS responses_lock_after_submit ON responses;
CREATE TRIGGER responses_lock_after_submit
  BEFORE INSERT OR UPDATE OR DELETE ON responses
  FOR EACH ROW EXECUTE FUNCTION responses_submission_locked();
