-- CreateEnum
CREATE TYPE "public"."CampaignType" AS ENUM ('EXPEDITION', 'MISSION');

-- CreateEnum
CREATE TYPE "public"."CampaignProgressStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "public"."live_sessions" ADD COLUMN     "campaign_progress_id" TEXT;

-- CreateTable
CREATE TABLE "public"."campaign_progresses" (
    "campaign_progress_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_type" "public"."CampaignType" NOT NULL,
    "status" "public"."CampaignProgressStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL,
    "epilogue_message" VARCHAR(500),
    "epilogue_submitted_at" TIMESTAMP(3),
    "predecessor_progress_id" TEXT,
    "predecessor_message_revealed_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_progresses_pkey" PRIMARY KEY ("campaign_progress_id")
);

-- CreateTable
CREATE TABLE "public"."campaign_step_unlocks" (
    "campaign_step_unlock_id" TEXT NOT NULL,
    "campaign_progress_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_key" TEXT NOT NULL,
    "live_session_id" TEXT,
    "rounds_played" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_step_unlocks_pkey" PRIMARY KEY ("campaign_step_unlock_id")
);

-- CreateIndex
CREATE INDEX "campaign_progresses_organization_id_class_section_id_idx" ON "public"."campaign_progresses"("organization_id", "class_section_id");

-- CreateIndex
CREATE INDEX "campaign_progresses_organization_id_campaign_id_status_idx" ON "public"."campaign_progresses"("organization_id", "campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_progresses_class_section_id_campaign_id_key" ON "public"."campaign_progresses"("class_section_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_step_unlocks_live_session_id_key" ON "public"."campaign_step_unlocks"("live_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_step_unlocks_campaign_progress_id_step_index_key" ON "public"."campaign_step_unlocks"("campaign_progress_id", "step_index");

-- AddForeignKey
ALTER TABLE "public"."live_sessions" ADD CONSTRAINT "live_sessions_campaign_progress_id_fkey" FOREIGN KEY ("campaign_progress_id") REFERENCES "public"."campaign_progresses"("campaign_progress_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_progresses" ADD CONSTRAINT "campaign_progresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_progresses" ADD CONSTRAINT "campaign_progresses_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_progresses" ADD CONSTRAINT "campaign_progresses_predecessor_progress_id_fkey" FOREIGN KEY ("predecessor_progress_id") REFERENCES "public"."campaign_progresses"("campaign_progress_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_step_unlocks" ADD CONSTRAINT "campaign_step_unlocks_campaign_progress_id_fkey" FOREIGN KEY ("campaign_progress_id") REFERENCES "public"."campaign_progresses"("campaign_progress_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_step_unlocks" ADD CONSTRAINT "campaign_step_unlocks_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("live_session_id") ON DELETE SET NULL ON UPDATE CASCADE;
