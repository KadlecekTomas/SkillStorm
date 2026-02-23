-- Enforce Assignment.yearId === ClassSection.yearId at DB level.
-- Enrollment already uses composite FK from prior migration.

ALTER TABLE "public"."assignments"
  DROP CONSTRAINT IF EXISTS "assignments_class_section_id_fkey";

ALTER TABLE "public"."assignments"
  ADD CONSTRAINT "assignments_class_section_id_academic_year_id_fkey"
  FOREIGN KEY ("class_section_id", "academic_year_id")
  REFERENCES "public"."class_sections"("class_section_id", "academic_year_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
