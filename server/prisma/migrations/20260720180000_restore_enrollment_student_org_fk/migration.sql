-- Restore the DB-level guarantee enrollment.organization_id == student.organization_id.
--
-- History: 20260223013000 added a composite unique on students(student_id,
-- organization_id) plus a composite FK from enrollments — both as raw SQL not
-- reflected in schema.prisma. The next `prisma migrate dev` (20260301223140)
-- therefore dropped them again as drift. The enrollment_org_consistency
-- trigger (20260714090000) covers enrollment-side INSERT/UPDATE, but nothing
-- guards the students side: `UPDATE students SET organization_id = ...`
-- silently leaves existing enrollments pointing cross-org.
--
-- This migration restores both constraints AND schema.prisma now declares
-- them (Student @@unique([id, orgId]) + composite relation on Enrollment),
-- so Prisma will no longer diff them away.
--
-- Idempotent on purpose: the feature/guardian-space branch adds the students
-- composite unique in 20260720164528_add_guardian_student_relation with the
-- same guard, so this must work regardless of which migration ran first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'students_student_id_organization_id_key'
      AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE "public"."students"
      ADD CONSTRAINT "students_student_id_organization_id_key"
      UNIQUE ("student_id", "organization_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_student_id_organization_id_fkey'
      AND conrelid = 'public.enrollments'::regclass
  ) THEN
    ALTER TABLE "public"."enrollments"
      ADD CONSTRAINT "enrollments_student_id_organization_id_fkey"
      FOREIGN KEY ("student_id", "organization_id")
      REFERENCES "public"."students"("student_id", "organization_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  -- Superseded by the composite FK above; keeping it would show up as drift
  -- against schema.prisma (the Enrollment→Student relation is now composite).
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_student_id_fkey'
      AND conrelid = 'public.enrollments'::regclass
  ) THEN
    ALTER TABLE "public"."enrollments"
      DROP CONSTRAINT "enrollments_student_id_fkey";
  END IF;
END $$;
