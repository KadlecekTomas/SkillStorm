-- AlterTable
ALTER TABLE "public"."academic_years" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "academic_years_organization_id_isCurrent_idx" ON "public"."academic_years"("organization_id", "isCurrent");

-- CreateIndex
CREATE INDEX "tests_organization_id_academic_year_id_subject_id_idx" ON "public"."tests"("organization_id", "academic_year_id", "subject_id");
