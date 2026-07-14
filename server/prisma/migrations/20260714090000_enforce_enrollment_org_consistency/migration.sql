-- Tenant isolation at the DB level for enrollments.
--
-- The e2e suite (sprint1-security) asserts that cross-org enrollments are
-- rejected by the DATABASE, not just the app layer. Such a trigger existed
-- only as a manual artifact in one dev database and was never captured in a
-- migration — a fresh install had no DB-level enforcement. This migration
-- makes the invariant real everywhere:
--   enrollments.organization_id == students.organization_id
--   enrollments.organization_id == class_sections.organization_id

CREATE OR REPLACE FUNCTION enforce_enrollment_org_consistency()
RETURNS trigger AS $$
DECLARE
  student_org text;
  class_org text;
BEGIN
  SELECT organization_id INTO student_org
  FROM students WHERE student_id = NEW.student_id;

  SELECT organization_id INTO class_org
  FROM class_sections WHERE class_section_id = NEW.class_section_id;

  IF student_org IS NULL OR class_org IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_ORG_CONSISTENCY: student or class section not found';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM student_org
     OR NEW.organization_id IS DISTINCT FROM class_org THEN
    RAISE EXCEPTION 'ENROLLMENT_ORG_CONSISTENCY: enrollment org (%) must match student org (%) and class org (%)',
      NEW.organization_id, student_org, class_org;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollment_org_consistency ON enrollments;
CREATE TRIGGER enrollment_org_consistency
BEFORE INSERT OR UPDATE OF student_id, class_section_id, organization_id
ON enrollments
FOR EACH ROW EXECUTE FUNCTION enforce_enrollment_org_consistency();
