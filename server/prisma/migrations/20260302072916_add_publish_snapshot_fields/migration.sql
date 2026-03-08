-- AlterTable
ALTER TABLE "public"."responses" ADD COLUMN     "awarded_points" INTEGER,
ADD COLUMN     "correct_answer_snapshot" TEXT,
ADD COLUMN     "max_points" INTEGER;

-- AlterTable
ALTER TABLE "public"."tests" ADD COLUMN     "published_at" TIMESTAMP(3);
