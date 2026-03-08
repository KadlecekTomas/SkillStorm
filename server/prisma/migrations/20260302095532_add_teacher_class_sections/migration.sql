-- CreateTable
CREATE TABLE "public"."teacher_class_sections" (
    "teacher_class_section_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teacher_class_sections_pkey" PRIMARY KEY ("teacher_class_section_id")
);

-- CreateIndex
CREATE INDEX "teacher_class_sections_class_section_id_idx" ON "public"."teacher_class_sections"("class_section_id");

-- CreateIndex
CREATE INDEX "teacher_class_sections_teacher_id_idx" ON "public"."teacher_class_sections"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_class_sections_teacher_id_class_section_id_key" ON "public"."teacher_class_sections"("teacher_id", "class_section_id");

-- AddForeignKey
ALTER TABLE "public"."teacher_class_sections" ADD CONSTRAINT "teacher_class_sections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("teacher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_class_sections" ADD CONSTRAINT "teacher_class_sections_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;
