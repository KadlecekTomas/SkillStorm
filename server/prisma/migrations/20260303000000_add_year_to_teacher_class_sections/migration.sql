-- Add academic_year_id to teacher_class_sections
-- Step 1: add as nullable so existing rows can be backfilled
ALTER TABLE "teacher_class_sections" ADD COLUMN "academic_year_id" VARCHAR(36);

-- Step 2: backfill from class_sections
UPDATE "teacher_class_sections" tcs
SET "academic_year_id" = cs."academic_year_id"
FROM "class_sections" cs
WHERE tcs."class_section_id" = cs."class_section_id";

-- Step 3: enforce NOT NULL now that all rows have a value
ALTER TABLE "teacher_class_sections" ALTER COLUMN "academic_year_id" SET NOT NULL;

-- Step 4: foreign key to academic_years (cascade delete/update)
ALTER TABLE "teacher_class_sections"
  ADD CONSTRAINT "teacher_class_sections_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id")
  REFERENCES "academic_years"("academic_year_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: composite index for year-scoped teacher assignment lookups
CREATE INDEX "teacher_class_sections_teacher_id_academic_year_id_idx"
  ON "teacher_class_sections"("teacher_id", "academic_year_id");
