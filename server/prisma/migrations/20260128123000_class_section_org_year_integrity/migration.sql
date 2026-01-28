-- Enforce class_sections.organization_id == academic_years.organization_id

CREATE OR REPLACE FUNCTION public.enforce_class_section_org_year()
RETURNS trigger AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.academic_years ay
    WHERE ay.academic_year_id = NEW.academic_year_id
      AND ay.organization_id = NEW.organization_id
  ) INTO ok;

  IF NOT ok THEN
    RAISE EXCEPTION 'Class section organization_id must match academic year organization_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS class_sections_enforce_org_year ON public.class_sections;
CREATE TRIGGER class_sections_enforce_org_year
BEFORE INSERT OR UPDATE ON public.class_sections
FOR EACH ROW EXECUTE FUNCTION public.enforce_class_section_org_year();
