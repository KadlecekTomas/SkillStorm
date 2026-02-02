-- Sprint 2: Assignment yearId, Submission assignmentId NOT NULL, invariant triggers
-- Idempotent, production-safe. Handles existing data via backfill.

-- 1) Remove submissions without assignment (legacy/demo only – cannot satisfy NOT NULL)
DELETE FROM public.submissions WHERE assignment_id IS NULL;

-- 2) Add academic_year_id to assignments (nullable for backfill)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS academic_year_id TEXT;

-- 3) Backfill yearId from class_section for CLASS assignments
UPDATE public.assignments a
SET academic_year_id = cs.academic_year_id
FROM public.class_sections cs
WHERE a.class_section_id = cs.class_section_id
  AND a.academic_year_id IS NULL;

-- 4) Backfill for STUDENTS assignments: use org's current year, else most recent
UPDATE public.assignments a
SET academic_year_id = (
  SELECT ay.academic_year_id
  FROM public.academic_years ay
  WHERE ay.organization_id = a.organization_id
  ORDER BY ay."isCurrent" DESC NULLS LAST, ay."startsAt" DESC
  LIMIT 1
)
WHERE a.academic_year_id IS NULL;

-- 5) Orphan assignments (org with no academic years): delete – cannot satisfy invariant
DELETE FROM public.assignments WHERE academic_year_id IS NULL;

-- 6) Enforce NOT NULL
ALTER TABLE public.assignments
  ALTER COLUMN academic_year_id SET NOT NULL;

-- 7) FK assignments → academic_years
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignments_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_academic_year_id_fkey
      FOREIGN KEY (academic_year_id)
      REFERENCES public.academic_years(academic_year_id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assignments_academic_year_id_idx
  ON public.assignments(academic_year_id);

-- 8) Assignment openAt < closeAt
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_open_before_close;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_open_before_close
  CHECK ("openAt" < "closeAt");

-- 9) Submission assignment_id NOT NULL + FK RESTRICT
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey;

-- Ensure no nulls (already deleted in step 1, but safe guard)
DELETE FROM public.submissions WHERE assignment_id IS NULL;

ALTER TABLE public.submissions
  ALTER COLUMN assignment_id SET NOT NULL;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_assignment_id_fkey
  FOREIGN KEY (assignment_id)
  REFERENCES public.assignments(assignment_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10) Trigger: Assignment.yearId == ClassSection.yearId when classSectionId set
CREATE OR REPLACE FUNCTION public.enforce_assignment_year_matches_class_section()
RETURNS trigger AS $$
DECLARE
  cs_year_id text;
BEGIN
  IF NEW.class_section_id IS NOT NULL THEN
    SELECT academic_year_id INTO cs_year_id
    FROM public.class_sections
    WHERE class_section_id = NEW.class_section_id;

    IF cs_year_id IS NULL THEN
      RAISE EXCEPTION 'Class section not found for assignment';
    END IF;

    IF NEW.academic_year_id <> cs_year_id THEN
      RAISE EXCEPTION 'Assignment academic_year_id must match class_section academic_year_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assignments_enforce_year_class_section ON public.assignments;
CREATE TRIGGER assignments_enforce_year_class_section
BEFORE INSERT OR UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_year_matches_class_section();

-- 11) Trigger: Assignment.organizationId == AcademicYear.orgId
CREATE OR REPLACE FUNCTION public.enforce_assignment_org_matches_year()
RETURNS trigger AS $$
DECLARE
  ay_org_id text;
BEGIN
  SELECT organization_id INTO ay_org_id
  FROM public.academic_years
  WHERE academic_year_id = NEW.academic_year_id;

  IF ay_org_id IS NULL THEN
    RAISE EXCEPTION 'Academic year not found for assignment';
  END IF;

  IF NEW.organization_id <> ay_org_id THEN
    RAISE EXCEPTION 'Assignment organization_id must match academic_year organization_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assignments_enforce_org_year ON public.assignments;
CREATE TRIGGER assignments_enforce_org_year
BEFORE INSERT OR UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_org_matches_year();

-- 12) Trigger: Submission.testId == Assignment.testId
CREATE OR REPLACE FUNCTION public.enforce_submission_test_matches_assignment()
RETURNS trigger AS $$
DECLARE
  a_test_id text;
BEGIN
  SELECT test_id INTO a_test_id
  FROM public.assignments
  WHERE assignment_id = NEW.assignment_id;

  IF a_test_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found for submission';
  END IF;

  IF NEW.test_id <> a_test_id THEN
    RAISE EXCEPTION 'Submission test_id must match assignment test_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_enforce_test_assignment ON public.submissions;
CREATE TRIGGER submissions_enforce_test_assignment
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_test_matches_assignment();
