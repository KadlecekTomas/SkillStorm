-- CreateEnum
CREATE TYPE "public"."XpEventType" AS ENUM ('LOGIN', 'TEST_COMPLETION', 'MATERIAL_VIEW', 'CUSTOM');

-- AlterEnum
ALTER TYPE "public"."PermissionKey" ADD VALUE 'VIEW_ANALYTICS';

-- CreateTable
CREATE TABLE "public"."levels" (
    "level_id" TEXT NOT NULL,
    "level_no" INTEGER NOT NULL,
    "min_xp" INTEGER NOT NULL,
    "badge_url" TEXT,
    "rewards" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("level_id")
);

-- CreateTable
CREATE TABLE "public"."xp_events" (
    "xp_event_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "event_type" "public"."XpEventType" NOT NULL,
    "value" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("xp_event_id")
);

-- CreateTable
CREATE TABLE "public"."achievements" (
    "achievement_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "condition" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("achievement_id")
);

-- CreateTable
CREATE TABLE "public"."membership_achievements" (
    "membership_achievement_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_achievements_pkey" PRIMARY KEY ("membership_achievement_id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "analytics_event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("analytics_event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "levels_level_no_key" ON "public"."levels"("level_no");

-- CreateIndex
CREATE INDEX "xp_events_membership_id_event_type_idx" ON "public"."xp_events"("membership_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "membership_achievements_membership_id_achievement_id_key" ON "public"."membership_achievements"("membership_id", "achievement_id");

-- CreateIndex
CREATE INDEX "analytics_events_organization_id_category_idx" ON "public"."analytics_events"("organization_id", "category");

-- AddForeignKey
ALTER TABLE "public"."xp_events" ADD CONSTRAINT "xp_events_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_achievements" ADD CONSTRAINT "membership_achievements_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_achievements" ADD CONSTRAINT "membership_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("achievement_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;
