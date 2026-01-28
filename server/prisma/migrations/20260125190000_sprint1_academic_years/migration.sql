-- Add created_at timestamps for core school-year models
ALTER TABLE "public"."academic_years" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."class_sections" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."enrollments" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Enforce single enrollment per student + academic year at the DB layer
DROP INDEX IF EXISTS "public"."enrollments_student_id_academic_year_id_key";
CREATE INDEX "enrollments_student_id_academic_year_id_idx" ON "public"."enrollments"("student_id", "academic_year_id");
