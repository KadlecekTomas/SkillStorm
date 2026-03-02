/*
  Warnings:

  - You are about to drop the column `org_subject_id` on the `tests` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."enrollments" DROP CONSTRAINT "enrollments_student_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."submissions" DROP CONSTRAINT "submissions_assignment_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tests" DROP CONSTRAINT "tests_org_subject_id_fkey";

-- DropConstraint (unique constraints must be dropped via ALTER TABLE, not DROP INDEX)
ALTER TABLE "public"."assignments" DROP CONSTRAINT "assignments_assignment_id_organization_id_key";

-- DropConstraint
ALTER TABLE "public"."students" DROP CONSTRAINT "students_student_id_organization_id_key";

-- AlterTable
ALTER TABLE "public"."audit_logs" ALTER COLUMN "system_role" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."responses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."tests" DROP COLUMN "org_subject_id",
ADD COLUMN     "academic_year_id" TEXT,
ADD COLUMN     "subject_id" TEXT;

-- CreateIndex
CREATE INDEX "tests_organization_id_academic_year_id_idx" ON "public"."tests"("organization_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "tests_subject_id_idx" ON "public"."tests"("subject_id");

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."assignments_org_created_at_idx" RENAME TO "assignments_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "public"."assignments_organization_id_academic_year_id_close_at_idx" RENAME TO "assignments_organization_id_academic_year_id_closeAt_idx";

-- RenameIndex
ALTER INDEX "public"."class_sections_org_id_year_id_idx" RENAME TO "class_sections_organization_id_academic_year_id_idx";

-- RenameIndex
ALTER INDEX "public"."enrollments_org_id_year_id_idx" RENAME TO "enrollments_organization_id_academic_year_id_idx";

-- RenameIndex
ALTER INDEX "public"."invites_org_created_at_idx" RENAME TO "invites_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "public"."submissions_organization_id_student_id_assignment_id_attempt_no" RENAME TO "submissions_organization_id_student_id_assignment_id_attemp_key";

-- RenameIndex
ALTER INDEX "public"."tests_org_created_at_deleted_at_idx" RENAME TO "tests_organization_id_created_at_deleted_at_idx";
