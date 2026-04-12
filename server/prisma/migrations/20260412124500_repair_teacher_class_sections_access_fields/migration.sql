DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TeacherClassAccessLevel'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."TeacherClassAccessLevel" AS ENUM ('VIEW', 'EDIT', 'HOMEROOM');
  END IF;
END $$;

ALTER TABLE "public"."teacher_class_sections"
  ADD COLUMN IF NOT EXISTS "access_level" "public"."TeacherClassAccessLevel" NOT NULL DEFAULT 'EDIT',
  ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

CREATE INDEX IF NOT EXISTS "teacher_class_sections_class_section_id_access_level_idx"
  ON "public"."teacher_class_sections"("class_section_id", "access_level");

CREATE INDEX IF NOT EXISTS "teacher_class_sections_teacher_id_access_level_idx"
  ON "public"."teacher_class_sections"("teacher_id", "access_level");

CREATE INDEX IF NOT EXISTS "teacher_class_sections_valid_from_valid_to_idx"
  ON "public"."teacher_class_sections"("valid_from", "valid_to");
