-- CreateTable
CREATE TABLE "public"."class_section_org_subjects" (
    "class_section_org_subject_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "org_subject_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_section_org_subjects_pkey" PRIMARY KEY ("class_section_org_subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_section_org_subjects_class_section_id_org_subject_id_key" ON "public"."class_section_org_subjects"("class_section_id", "org_subject_id");

-- CreateIndex
CREATE INDEX "class_section_org_subjects_org_subject_id_idx" ON "public"."class_section_org_subjects"("org_subject_id");

-- AddForeignKey
ALTER TABLE "public"."class_section_org_subjects" ADD CONSTRAINT "class_section_org_subjects_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_section_org_subjects" ADD CONSTRAINT "class_section_org_subjects_org_subject_id_fkey" FOREIGN KEY ("org_subject_id") REFERENCES "public"."org_subjects"("org_subject_id") ON DELETE CASCADE ON UPDATE CASCADE;
