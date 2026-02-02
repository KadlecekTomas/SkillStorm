-- Prevent changing academic_years.organization_id

CREATE OR REPLACE FUNCTION public.prevent_academic_year_org_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
     AND COALESCE(current_setting('app.allow_academic_year_org_change', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'academic_years.organization_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academic_years_block_org_change ON public.academic_years;
CREATE TRIGGER academic_years_block_org_change
BEFORE UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.prevent_academic_year_org_change();

-- Verification (should fail):
-- UPDATE public.academic_years SET organization_id = 'other-org' WHERE academic_year_id = '<id>';
-- Controlled override (maintenance only):
-- SELECT set_config('app.allow_academic_year_org_change', 'true', true);
-- UPDATE public.academic_years SET organization_id = 'other-org' WHERE academic_year_id = '<id>';
-- SELECT set_config('app.allow_academic_year_org_change', 'false', true);
