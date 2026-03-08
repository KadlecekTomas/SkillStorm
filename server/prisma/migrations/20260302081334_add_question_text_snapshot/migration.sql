-- AlterTable
ALTER TABLE "public"."responses" ADD COLUMN     "question_text_snapshot" TEXT;

-- CreateIndex
CREATE INDEX "submissions_test_id_student_id_idx" ON "public"."submissions"("test_id", "student_id");
