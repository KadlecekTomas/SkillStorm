-- AlterTable
ALTER TABLE "public"."subjects" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "subjects_organization_id_is_active_idx" ON "public"."subjects"("organization_id", "is_active");
