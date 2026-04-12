ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CATALOG_SUBJECT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CATALOG_TOPIC';

ALTER TABLE "catalog_subjects"
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "catalog_topics"
  ADD COLUMN IF NOT EXISTS "order" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "catalog_subjects_is_active_deleted_at_idx"
  ON "catalog_subjects"("is_active", "deleted_at");

CREATE INDEX IF NOT EXISTS "catalog_subjects_name_idx"
  ON "catalog_subjects"("name");

CREATE INDEX IF NOT EXISTS "catalog_topics_subject_id_is_active_deleted_at_order_idx"
  ON "catalog_topics"("catalog_subject_id", "is_active", "deleted_at", "order");
