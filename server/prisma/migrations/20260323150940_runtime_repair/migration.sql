-- DropForeignKey
ALTER TABLE "public"."teacher_class_sections" DROP CONSTRAINT "teacher_class_sections_academic_year_id_fkey";

-- DropIndex
DROP INDEX "public"."tests_allowed_grades_gin_idx";

-- AlterTable
ALTER TABLE "public"."support_tickets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."teacher_class_sections" ALTER COLUMN "academic_year_id" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "org_subjects_subject_id_idx" ON "public"."org_subjects"("subject_id");

-- AddForeignKey
ALTER TABLE "public"."teacher_class_sections" ADD CONSTRAINT "teacher_class_sections_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE ON UPDATE CASCADE;
