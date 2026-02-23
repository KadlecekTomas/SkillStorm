-- AlterTable promotion_logs: add audit/metric columns
ALTER TABLE "promotion_logs" ADD COLUMN "classes_created_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "promotion_logs" ADD COLUMN "students_migrated_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "promotion_logs" ADD COLUMN "skipped_classes_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "promotion_logs" ADD COLUMN "duration_ms" INTEGER NOT NULL DEFAULT 0;

-- Index for promotion query: list class sections by org + year
CREATE INDEX IF NOT EXISTS "class_sections_org_id_year_id_idx" ON "class_sections"("organization_id", "academic_year_id");

-- Index for promotion query: list enrollments by org + year
CREATE INDEX IF NOT EXISTS "enrollments_org_id_year_id_idx" ON "enrollments"("organization_id", "academic_year_id");
