-- Prevent changing class_sections.academic_year_id when enrollments exist

CREATE OR REPLACE FUNCTION public.prevent_class_section_year_change()
RETURNS trigger AS $$
DECLARE
  enr_count integer;
BEGIN
  IF NEW.academic_year_id <> OLD.academic_year_id THEN
    SELECT COUNT(1)
      INTO enr_count
      FROM public.enrollments
     WHERE class_section_id = OLD.class_section_id;

    IF enr_count > 0 THEN
      RAISE EXCEPTION 'Class section academic_year_id is immutable once enrollments exist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS class_sections_block_year_change ON public.class_sections;
CREATE TRIGGER class_sections_block_year_change
BEFORE UPDATE ON public.class_sections
FOR EACH ROW EXECUTE FUNCTION public.prevent_class_section_year_change();
