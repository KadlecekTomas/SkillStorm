-- Enforce enrollment.orgId matches student.organizationId (DB-level invariant).
-- Requires composite uniqueness on students (student_id, organization_id).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_student_id_organization_id_key'
  ) THEN
    ALTER TABLE "public"."students"
      ADD CONSTRAINT "students_student_id_organization_id_key"
      UNIQUE ("student_id", "organization_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_student_id_organization_id_fkey'
  ) THEN
    ALTER TABLE "public"."enrollments"
      ADD CONSTRAINT "enrollments_student_id_organization_id_fkey"
      FOREIGN KEY ("student_id", "organization_id")
      REFERENCES "public"."students"("student_id", "organization_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
