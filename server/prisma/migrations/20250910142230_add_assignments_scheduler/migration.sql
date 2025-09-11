/*
  Warnings:

  - A unique constraint covering the columns `[assignment_id,student_id,attempt_no]` on the table `submissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[test_id,student_id,attempt_no]` on the table `submissions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `submissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."submissions" ADD COLUMN     "assignment_id" TEXT,
ADD COLUMN     "attempt_no" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "submitted_at" DROP NOT NULL,
ALTER COLUMN "submitted_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."assignments" (
    "assignment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'CLASS',
    "class_section_id" TEXT,
    "topic_level_id" TEXT,
    "openAt" TIMESTAMP(3) NOT NULL,
    "closeAt" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "time_limit_sec" INTEGER,
    "shuffle" BOOLEAN NOT NULL DEFAULT true,
    "showExplain" TEXT NOT NULL DEFAULT 'after_close',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "public"."assignment_students" (
    "assignment_student_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "assignment_students_pkey" PRIMARY KEY ("assignment_student_id")
);

-- CreateIndex
CREATE INDEX "assignments_organization_id_class_section_id_idx" ON "public"."assignments"("organization_id", "class_section_id");

-- CreateIndex
CREATE INDEX "assignments_test_id_idx" ON "public"."assignments"("test_id");

-- CreateIndex
CREATE INDEX "assignment_students_student_id_idx" ON "public"."assignment_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_students_assignment_id_student_id_key" ON "public"."assignment_students"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "submissions_assignment_id_idx" ON "public"."submissions"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_student_id_attempt_no_key" ON "public"."submissions"("assignment_id", "student_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_test_id_student_id_attempt_no_key" ON "public"."submissions"("test_id", "student_id", "attempt_no");

-- AddForeignKey
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("test_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_topic_level_id_fkey" FOREIGN KEY ("topic_level_id") REFERENCES "public"."topic_levels"("topic_level_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_students" ADD CONSTRAINT "assignment_students_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("assignment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_students" ADD CONSTRAINT "assignment_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;
