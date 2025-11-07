/*
  Warnings:

  - You are about to drop the `RevokedToken` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organization_id,role,permission_id]` on the table `role_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,organization_id,permission_id]` on the table `user_permissions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."OrganizationRole" ADD VALUE 'OWNER';
ALTER TYPE "public"."OrganizationRole" ADD VALUE 'PARENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."SystemRole" ADD VALUE 'DEVOPS';
ALTER TYPE "public"."SystemRole" ADD VALUE 'SUPPORT';

-- DropIndex
DROP INDEX "public"."role_permissions_role_permission_id_key";

-- DropIndex
DROP INDEX "public"."user_permissions_user_id_permission_id_key";

-- AlterTable
ALTER TABLE "public"."permissions" ADD COLUMN     "category" VARCHAR(100),
ADD COLUMN     "is_deprecated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."role_permissions" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "public"."user_permissions" ADD COLUMN     "organization_id" TEXT;

-- DropTable
DROP TABLE "public"."RevokedToken";

-- CreateTable
CREATE TABLE "public"."revoked_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revoked_tokens_token_key" ON "public"."revoked_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_organization_id_role_permission_id_key" ON "public"."role_permissions"("organization_id", "role", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_organization_id_permission_id_key" ON "public"."user_permissions"("user_id", "organization_id", "permission_id");

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
