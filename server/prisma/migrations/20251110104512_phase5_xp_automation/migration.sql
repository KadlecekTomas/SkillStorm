-- Extend XpEventType for automated triggers
ALTER TYPE "public"."XpEventType" ADD VALUE IF NOT EXISTS 'USER_LOGIN';
ALTER TYPE "public"."XpEventType" ADD VALUE IF NOT EXISTS 'MATERIAL_VIEWED';
ALTER TYPE "public"."XpEventType" ADD VALUE IF NOT EXISTS 'TEST_COMPLETED';

-- Track structured metadata for XP events
ALTER TABLE "public"."xp_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Enrich analytics events with label/value fields
ALTER TABLE "public"."analytics_events" ADD COLUMN IF NOT EXISTS "label" VARCHAR(120);
ALTER TABLE "public"."analytics_events" ADD COLUMN IF NOT EXISTS "value" INTEGER;
