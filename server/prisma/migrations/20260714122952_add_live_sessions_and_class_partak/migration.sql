-- CreateEnum
CREATE TYPE "public"."LiveSessionMode" AS ENUM ('BOARD_ONLY', 'DEVICES');

-- CreateEnum
CREATE TYPE "public"."LiveSessionStatus" AS ENUM ('DRAFT', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."LiveAgeMode" AS ENUM ('YOUNG', 'MIDDLE', 'SENIOR');

-- CreateEnum
CREATE TYPE "public"."LiveRoundOutcome" AS ENUM ('MOSTLY_CORRECT', 'SPLIT', 'MOSTLY_WRONG');

-- CreateEnum
CREATE TYPE "public"."ClassPartakXpType" AS ENUM ('ROUND_PLAYED', 'SESSION_FINISHED');

-- CreateTable
CREATE TABLE "public"."live_sessions" (
    "live_session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "host_membership_id" TEXT NOT NULL,
    "class_section_id" TEXT,
    "test_id" TEXT NOT NULL,
    "mode" "public"."LiveSessionMode" NOT NULL DEFAULT 'BOARD_ONLY',
    "status" "public"."LiveSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "age_mode" "public"."LiveAgeMode" NOT NULL,
    "countdown_sec" INTEGER,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "xp_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("live_session_id")
);

-- CreateTable
CREATE TABLE "public"."live_session_rounds" (
    "live_session_round_id" TEXT NOT NULL,
    "live_session_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question_id" TEXT,
    "question_text" TEXT NOT NULL,
    "options_snapshot" JSONB NOT NULL,
    "correct_key_snapshot" TEXT NOT NULL,
    "outcome" "public"."LiveRoundOutcome",
    "revealed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "live_session_rounds_pkey" PRIMARY KEY ("live_session_round_id")
);

-- CreateTable
CREATE TABLE "public"."live_session_participants" (
    "live_session_participant_id" TEXT NOT NULL,
    "live_session_id" TEXT NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "join_token" TEXT NOT NULL,
    "membership_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "live_session_participants_pkey" PRIMARY KEY ("live_session_participant_id")
);

-- CreateTable
CREATE TABLE "public"."class_partaks" (
    "class_partak_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_partaks_pkey" PRIMARY KEY ("class_partak_id")
);

-- CreateTable
CREATE TABLE "public"."class_partak_xp_events" (
    "class_partak_xp_event_id" TEXT NOT NULL,
    "class_partak_id" TEXT NOT NULL,
    "live_session_id" TEXT,
    "event_type" "public"."ClassPartakXpType" NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_partak_xp_events_pkey" PRIMARY KEY ("class_partak_xp_event_id")
);

-- CreateIndex
CREATE INDEX "live_sessions_organization_id_status_idx" ON "public"."live_sessions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "live_sessions_host_membership_id_created_at_idx" ON "public"."live_sessions"("host_membership_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "live_session_rounds_live_session_id_order_key" ON "public"."live_session_rounds"("live_session_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "live_session_participants_join_token_key" ON "public"."live_session_participants"("join_token");

-- CreateIndex
CREATE INDEX "live_session_participants_live_session_id_idx" ON "public"."live_session_participants"("live_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_partaks_class_section_id_key" ON "public"."class_partaks"("class_section_id");

-- CreateIndex
CREATE INDEX "class_partaks_organization_id_idx" ON "public"."class_partaks"("organization_id");

-- CreateIndex
CREATE INDEX "class_partak_xp_events_class_partak_id_created_at_idx" ON "public"."class_partak_xp_events"("class_partak_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."live_sessions" ADD CONSTRAINT "live_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_sessions" ADD CONSTRAINT "live_sessions_host_membership_id_fkey" FOREIGN KEY ("host_membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_sessions" ADD CONSTRAINT "live_sessions_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_sessions" ADD CONSTRAINT "live_sessions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_session_rounds" ADD CONSTRAINT "live_session_rounds_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_session_rounds" ADD CONSTRAINT "live_session_rounds_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_session_participants" ADD CONSTRAINT "live_session_participants_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."live_session_participants" ADD CONSTRAINT "live_session_participants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_partaks" ADD CONSTRAINT "class_partaks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_partaks" ADD CONSTRAINT "class_partaks_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_partak_xp_events" ADD CONSTRAINT "class_partak_xp_events_class_partak_id_fkey" FOREIGN KEY ("class_partak_id") REFERENCES "public"."class_partaks"("class_partak_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_partak_xp_events" ADD CONSTRAINT "class_partak_xp_events_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("live_session_id") ON DELETE SET NULL ON UPDATE CASCADE;
