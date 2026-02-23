-- AlterTable
ALTER TABLE "public"."tests" ADD COLUMN     "org_subject_id" TEXT;

-- CreateTable
CREATE TABLE "public"."org_subjects" (
    "org_subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade_from" INTEGER NOT NULL,
    "grade_to" INTEGER NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_subjects_pkey" PRIMARY KEY ("org_subject_id")
);

-- CreateIndex
CREATE INDEX "org_subjects_organization_id_idx" ON "public"."org_subjects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_subjects_organization_id_name_grade_from_grade_to_key" ON "public"."org_subjects"("organization_id", "name", "grade_from", "grade_to");

-- AddForeignKey
ALTER TABLE "public"."org_subjects" ADD CONSTRAINT "org_subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tests" ADD CONSTRAINT "tests_org_subject_id_fkey" FOREIGN KEY ("org_subject_id") REFERENCES "public"."org_subjects"("org_subject_id") ON DELETE SET NULL ON UPDATE CASCADE;
