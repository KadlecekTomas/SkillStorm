-- CreateEnum
CREATE TYPE "public"."OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."organizations" ADD COLUMN "status" "public"."OrganizationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "public"."organizations" ADD COLUMN "owner_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_owner_user_id_key" ON "public"."organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "public"."organizations"("status");

-- AddForeignKey
ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing orgs become ACTIVE (legacy); owner_user_id stays null
UPDATE "public"."organizations" SET status = 'ACTIVE' WHERE "deleted_at" IS NULL;
