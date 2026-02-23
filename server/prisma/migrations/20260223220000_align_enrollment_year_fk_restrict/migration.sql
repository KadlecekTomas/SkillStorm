-- Align Enrollment -> ClassSection year-composite FK delete behavior.
-- Remove legacy single-column FK and enforce composite FK with RESTRICT.

ALTER TABLE "public"."enrollments"
  DROP CONSTRAINT IF EXISTS "enrollments_class_section_id_fkey";

ALTER TABLE "public"."enrollments"
  DROP CONSTRAINT IF EXISTS "enrollments_class_section_id_academic_year_id_fkey";

ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_class_section_id_academic_year_id_fkey"
  FOREIGN KEY ("class_section_id", "academic_year_id")
  REFERENCES "public"."class_sections"("class_section_id", "academic_year_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
