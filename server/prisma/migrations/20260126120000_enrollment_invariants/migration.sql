-- Enforce Enrollment invariants

-- Normalize existing data before constraints
UPDATE public.enrollments e
SET academic_year_id = cs.academic_year_id
FROM public.class_sections cs
WHERE e.class_section_id = cs.class_section_id
  AND e.academic_year_id <> cs.academic_year_id;

WITH ranked AS (
  SELECT enrollment_id,
         student_id,
         academic_year_id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, academic_year_id
           ORDER BY created_at DESC, enrollment_id DESC
         ) AS rn
  FROM public.enrollments
)
DELETE FROM public.enrollments e
USING ranked r
WHERE e.enrollment_id = r.enrollment_id
  AND r.rn > 1;

DELETE FROM public.students s
WHERE NOT EXISTS (
  SELECT 1 FROM public.enrollments e WHERE e.student_id = s.student_id
);

-- Ensure uniqueness per student + academic year
DROP INDEX IF EXISTS "public"."enrollments_student_id_academic_year_id_idx";
CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_key"
  ON "public"."enrollments"("student_id", "academic_year_id");

-- Enforce enrollment.year == class_section.year
CREATE OR REPLACE FUNCTION public.enforce_enrollment_year()
RETURNS trigger AS $$
DECLARE
  class_year_id text;
BEGIN
  SELECT academic_year_id
    INTO class_year_id
    FROM public.class_sections
   WHERE class_section_id = NEW.class_section_id;

  IF class_year_id IS NULL THEN
    RAISE EXCEPTION 'Class section not found for enrollment';
  END IF;

  IF class_year_id <> NEW.academic_year_id THEN
    RAISE EXCEPTION 'Enrollment academic_year_id does not match class_section academic_year_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_enforce_year ON public.enrollments;
CREATE TRIGGER enrollments_enforce_year
BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.enforce_enrollment_year();

-- Hard block legacy student_classrooms writes (Enrollment is the only source of truth)
CREATE OR REPLACE FUNCTION public.block_student_classrooms_writes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'student_classrooms is read-only. Use enrollments as source of truth.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_classrooms_block_writes ON public.student_classrooms;
CREATE TRIGGER student_classrooms_block_writes
BEFORE INSERT OR UPDATE ON public.student_classrooms
FOR EACH ROW EXECUTE FUNCTION public.block_student_classrooms_writes();

-- Enforce: student must have at least one enrollment (deferrable)
CREATE OR REPLACE FUNCTION public.enforce_student_has_enrollment()
RETURNS trigger AS $$
DECLARE
  enrollment_count integer;
BEGIN
  SELECT COUNT(1)
    INTO enrollment_count
    FROM public.enrollments
   WHERE student_id = NEW.student_id;

  IF enrollment_count = 0 THEN
    RAISE EXCEPTION 'Student must have at least one enrollment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_enforce_enrollment ON public.students;
CREATE CONSTRAINT TRIGGER students_enforce_enrollment
AFTER INSERT OR UPDATE ON public.students
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_has_enrollment();

CREATE OR REPLACE FUNCTION public.enforce_student_has_enrollment_on_change()
RETURNS trigger AS $$
DECLARE
  student_exists boolean;
  enrollment_count integer;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.students WHERE student_id = OLD.student_id
  ) INTO student_exists;

  IF NOT student_exists THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(1)
    INTO enrollment_count
    FROM public.enrollments
   WHERE student_id = OLD.student_id;

  IF enrollment_count = 0 THEN
    RAISE EXCEPTION 'Student must have at least one enrollment';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_enforce_student ON public.enrollments;
CREATE CONSTRAINT TRIGGER enrollments_enforce_student
AFTER DELETE OR UPDATE OF student_id ON public.enrollments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_has_enrollment_on_change();
