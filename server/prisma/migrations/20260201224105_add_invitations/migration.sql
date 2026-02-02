-- CreateEnum
CREATE TYPE "public"."InvitationType" AS ENUM ('ORG_ONLY', 'STUDENT_CLASS');

-- CreateTable
CREATE TABLE "public"."invitations" (
    "invitation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "public"."InvitationType" NOT NULL DEFAULT 'ORG_ONLY',
    "role" "public"."OrganizationRole",
    "class_section_id" TEXT,
    "academic_year_id" TEXT,
    "code" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_membership_id" TEXT,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("invitation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_code_key" ON "public"."invitations"("code");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "public"."invitations"("organization_id");

-- CreateIndex
CREATE INDEX "invitations_code_idx" ON "public"."invitations"("code");

-- AddForeignKey
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK: STUDENT_CLASS requires classSectionId and yearId; ORG_ONLY requires both null
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_type_class_year_check"
  CHECK (
    (type = 'STUDENT_CLASS' AND class_section_id IS NOT NULL AND academic_year_id IS NOT NULL)
    OR (type = 'ORG_ONLY' AND class_section_id IS NULL AND academic_year_id IS NULL)
  );
