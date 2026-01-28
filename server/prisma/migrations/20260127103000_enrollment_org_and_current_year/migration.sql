-- Enforce enrollment org integrity + single current academic year per org

-- 1) Add organization_id to enrollments (backfill + constraints)
ALTER TABLE "public"."enrollments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Remove invalid cross-org enrollments before backfill
DELETE FROM public.enrollments e
USING public.students s, public.class_sections cs
WHERE e.student_id = s.student_id
  AND e.class_section_id = cs.class_section_id
  AND s.organization_id <> cs.organization_id;

-- Backfill org id from class section
UPDATE public.enrollments e
SET organization_id = cs.organization_id
FROM public.class_sections cs
WHERE e.class_section_id = cs.class_section_id
  AND (e.organization_id IS NULL OR e.organization_id <> cs.organization_id);

-- Ensure no NULLs remain
UPDATE public.enrollments e
SET organization_id = s.organization_id
FROM public.students s
WHERE e.student_id = s.student_id
  AND e.organization_id IS NULL;

ALTER TABLE "public"."enrollments" ALTER COLUMN "organization_id" SET NOT NULL;

-- FK + index
ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "enrollments_organization_id_idx" ON "public"."enrollments"("organization_id");

-- Enforce org integrity (student.org == class_section.org == enrollment.org)
CREATE OR REPLACE FUNCTION public.enforce_enrollment_org()
RETURNS trigger AS $$
DECLARE
  class_org_id text;
  student_org_id text;
BEGIN
  SELECT organization_id
    INTO class_org_id
    FROM public.class_sections
   WHERE class_section_id = NEW.class_section_id;

  IF class_org_id IS NULL THEN
    RAISE EXCEPTION 'Class section not found for enrollment';
  END IF;

  SELECT organization_id
    INTO student_org_id
    FROM public.students
   WHERE student_id = NEW.student_id;

  IF student_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found for enrollment';
  END IF;

  IF class_org_id <> student_org_id THEN
    RAISE EXCEPTION 'Enrollment organization mismatch (student vs class section)';
  END IF;

  IF NEW.organization_id <> class_org_id THEN
    RAISE EXCEPTION 'Enrollment organization_id does not match class section organization_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_enforce_org ON public.enrollments;
CREATE TRIGGER enrollments_enforce_org
BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.enforce_enrollment_org();

-- 2) Ensure single current academic year per org (cleanup + partial unique index)
WITH ranked AS (
  SELECT academic_year_id,
         organization_id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id
           ORDER BY "startsAt" DESC, created_at DESC, academic_year_id DESC
         ) AS rn
  FROM public.academic_years
  WHERE "isCurrent" = true
)
UPDATE public.academic_years ay
SET "isCurrent" = false
FROM ranked r
WHERE ay.academic_year_id = r.academic_year_id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_one_current_per_org"
  ON public.academic_years(organization_id)
  WHERE "isCurrent" = true;
