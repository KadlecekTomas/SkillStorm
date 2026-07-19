-- AlterTable
ALTER TABLE "public"."live_session_rounds" ADD COLUMN     "vote_counts" JSONB,
ADD COLUMN     "voting_started_at" TIMESTAMP(3);
