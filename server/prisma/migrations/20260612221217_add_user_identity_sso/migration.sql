-- CreateEnum
CREATE TYPE "public"."IdentityProvider" AS ENUM ('GOOGLE');

-- AlterTable
ALTER TABLE "public"."catalog_subjects" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."catalog_topics" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."organization_settings" ADD COLUMN     "sso_allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sso_auto_provision" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."user_identities" (
    "user_identity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" "public"."IdentityProvider" NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(150),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("user_identity_id")
);

-- CreateIndex
CREATE INDEX "user_identities_organization_id_provider_idx" ON "public"."user_identities"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "user_identities_email_idx" ON "public"."user_identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_subject_key" ON "public"."user_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_user_id_provider_key" ON "public"."user_identities"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "public"."user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_identities" ADD CONSTRAINT "user_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."catalog_topics_subject_id_is_active_deleted_at_order_idx" RENAME TO "catalog_topics_catalog_subject_id_is_active_deleted_at_orde_idx";
