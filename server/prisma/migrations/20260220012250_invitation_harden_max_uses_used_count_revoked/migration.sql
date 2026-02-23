-- AlterEnum
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'STUDENT';

-- AlterTable
ALTER TABLE "public"."invitations" ADD COLUMN     "max_uses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "used_count" INTEGER NOT NULL DEFAULT 0;
