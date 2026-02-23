-- Alter invites to support unified Invite model
ALTER TABLE "public"."invites" ADD COLUMN "type" "public"."InvitationType" NOT NULL DEFAULT 'ORG_ONLY';
ALTER TABLE "public"."invites" ADD COLUMN "class_section_id" TEXT;
ALTER TABLE "public"."invites" ADD COLUMN "academic_year_id" TEXT;
ALTER TABLE "public"."invites" ADD COLUMN "max_uses" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "public"."invites" ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."invites" ADD COLUMN "revoked_at" TIMESTAMP(3);

-- Replace used_at with used_count
ALTER TABLE "public"."invites" DROP COLUMN "used_at";

-- Indexes for invite scoping
CREATE INDEX "invites_class_section_id_idx" ON "public"."invites"("class_section_id");
CREATE INDEX "invites_academic_year_id_idx" ON "public"."invites"("academic_year_id");

-- Foreign keys for class/year scoped invites
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE ON UPDATE CASCADE;
