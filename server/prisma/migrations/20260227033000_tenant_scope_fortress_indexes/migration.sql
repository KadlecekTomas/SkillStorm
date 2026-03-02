-- Tenant-scope fortress indexes
CREATE INDEX IF NOT EXISTS "tests_organization_id_status_deleted_at_idx"
  ON "tests"("organization_id", "status", "deleted_at");

CREATE INDEX IF NOT EXISTS "assignments_organization_id_academic_year_id_close_at_idx"
  ON "assignments"("organization_id", "academic_year_id", "closeAt");

CREATE INDEX IF NOT EXISTS "submissions_organization_id_student_id_created_at_idx"
  ON "submissions"("organization_id", "student_id", "created_at");

CREATE INDEX IF NOT EXISTS "enrollments_organization_id_academic_year_id_student_id_idx"
  ON "enrollments"("organization_id", "academic_year_id", "student_id");
