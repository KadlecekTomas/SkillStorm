-- Enforce I2: enrollments.academic_year_id must match class_sections.academic_year_id
-- Relational integrity via composite FK (no subqueries).
-- Existing data is assumed valid.

-- Ensure the referenced pair is unique.
ALTER TABLE "public"."class_sections"
  ADD CONSTRAINT "class_sections_class_section_id_academic_year_id_key"
  UNIQUE ("class_section_id", "academic_year_id");

-- Enforce the invariant at the database level.
ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_class_section_id_academic_year_id_fkey"
  FOREIGN KEY ("class_section_id", "academic_year_id")
  REFERENCES "public"."class_sections"("class_section_id", "academic_year_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
