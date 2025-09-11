-- AlterTable
ALTER TABLE "public"."questions" ADD COLUMN     "correctAnswer" TEXT,
ADD COLUMN     "correctAnswers" TEXT[],
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 1;
