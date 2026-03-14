ALTER TABLE "public"."subjects"
  ADD COLUMN IF NOT EXISTS "grade_from" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "grade_to" INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."subjects"
SET
  "grade_from" = CASE
    WHEN "name" IN ('Prvouka') THEN 1
    WHEN "name" IN ('Přírodověda', 'Vlastivěda') THEN 4
    WHEN "name" IN ('Přírodopis', 'Fyzika', 'Dějepis', 'Zeměpis') THEN 6
    WHEN "name" IN ('Chemie') THEN 8
    ELSE 1
  END,
  "grade_to" = CASE
    WHEN "name" IN ('Prvouka') THEN 3
    WHEN "name" IN ('Přírodověda', 'Vlastivěda') THEN 5
    WHEN "name" IN ('Přírodopis', 'Fyzika', 'Dějepis', 'Zeměpis') THEN 9
    WHEN "name" IN ('Chemie') THEN 9
    ELSE 9
  END;

ALTER TABLE "public"."org_subjects"
  ADD COLUMN IF NOT EXISTS "subject_id" TEXT,
  ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_custom" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_subjects'
      AND column_name = 'name'
  ) THEN
    EXECUTE $sql$
      UPDATE "public"."org_subjects" os
      SET "subject_id" = s."subject_id"
      FROM "public"."subjects" s
      WHERE os."subject_id" IS NULL
        AND s."organization_id" = os."organization_id"
        AND s."name" = os."name"
        AND s."deleted_at" IS NULL
    $sql$;
  END IF;
END $$;

INSERT INTO "public"."org_subjects" (
  "org_subject_id",
  "organization_id",
  "subject_id",
  "is_enabled",
  "is_custom",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  s."organization_id",
  s."subject_id",
  COALESCE(s."is_active", true),
  CASE WHEN s."catalog_subject_id" IS NULL THEN true ELSE false END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."subjects" s
WHERE s."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."org_subjects" os
    WHERE os."organization_id" = s."organization_id"
      AND os."subject_id" = s."subject_id"
  );

DELETE FROM "public"."org_subjects" os
USING "public"."org_subjects" dup
WHERE os."subject_id" IS NOT NULL
  AND dup."subject_id" IS NOT NULL
  AND os."organization_id" = dup."organization_id"
  AND os."subject_id" = dup."subject_id"
  AND os."org_subject_id" > dup."org_subject_id";

ALTER TABLE "public"."org_subjects"
  ALTER COLUMN "subject_id" SET NOT NULL;

ALTER TABLE "public"."org_subjects"
  DROP CONSTRAINT IF EXISTS "org_subjects_organization_id_name_grade_from_grade_to_key";

ALTER TABLE "public"."org_subjects"
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "grade_from",
  DROP COLUMN IF EXISTS "grade_to";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_subjects_subject_id_fkey'
  ) THEN
    ALTER TABLE "public"."org_subjects"
      ADD CONSTRAINT "org_subjects_subject_id_fkey"
      FOREIGN KEY ("subject_id")
      REFERENCES "public"."subjects"("subject_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subjects_organization_id_name_key'
  ) THEN
    ALTER TABLE "public"."subjects"
      ADD CONSTRAINT "subjects_organization_id_name_key"
      UNIQUE ("organization_id", "name");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_subjects_organization_id_subject_id_key'
  ) THEN
    ALTER TABLE "public"."org_subjects"
      ADD CONSTRAINT "org_subjects_organization_id_subject_id_key"
      UNIQUE ("organization_id", "subject_id");
  END IF;
END $$;
