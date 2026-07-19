-- Interaktivní kola bleskovek (MATCH_PAIRS / ORDER / SORT_BINS)

-- CreateEnum
CREATE TYPE "RoundInteractionType" AS ENUM ('QUIZ', 'MATCH_PAIRS', 'ORDER', 'SORT_BINS');

-- AlterEnum: interaktivní typy otázek (pouze bleskovky)
ALTER TYPE "QuestionType" ADD VALUE 'MATCH_PAIRS';
ALTER TYPE "QuestionType" ADD VALUE 'ORDER';
ALTER TYPE "QuestionType" ADD VALUE 'SORT_BINS';

-- AlterTable: autorská data interaktivních typů
ALTER TABLE "questions" ADD COLUMN "content" JSONB;

-- AlterTable: kvízové snapshoty jsou nově nullable (interaktivní kola je nemají),
-- interaktivní kola dostávají board-safe obsah + server-only řešení + agregát průběhu
ALTER TABLE "live_session_rounds"
  ADD COLUMN "interaction_type" "RoundInteractionType" NOT NULL DEFAULT 'QUIZ',
  ADD COLUMN "content_snapshot" JSONB,
  ADD COLUMN "solution_snapshot" JSONB,
  ADD COLUMN "attempt_stats" JSONB,
  ALTER COLUMN "options_snapshot" DROP NOT NULL,
  ALTER COLUMN "correct_key_snapshot" DROP NOT NULL;
