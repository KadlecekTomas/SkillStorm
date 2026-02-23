-- Persist count of enrollments skipped during promotion (skipDuplicates) for observability.
ALTER TABLE "promotion_logs" ADD COLUMN IF NOT EXISTS "enrollments_skipped_count" INTEGER NOT NULL DEFAULT 0;
