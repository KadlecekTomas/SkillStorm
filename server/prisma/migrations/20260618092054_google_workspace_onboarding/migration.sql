-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('GOOGLE_WORKSPACE', 'GOOGLE_CLASSROOM', 'MICROSOFT_365', 'BAKALARI');

-- CreateEnum
CREATE TYPE "public"."IntegrationStatus" AS ENUM ('CONNECTED', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."ExternalIdentityType" AS ENUM ('USER', 'GROUP', 'CLASSROOM_COURSE', 'ORG_UNIT');

-- CreateEnum
CREATE TYPE "public"."SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."SyncIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."SyncMode" AS ENUM ('AUTO', 'MANUAL_OVERRIDE', 'IGNORED');

-- CreateTable
CREATE TABLE "public"."organization_integrations" (
    "organization_integration_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "status" "public"."IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "domain" TEXT,
    "customer_id" TEXT,
    "scopes" TEXT[],
    "connected_by_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "encrypted_refresh_token" TEXT,
    "encrypted_access_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("organization_integration_id")
);

-- CreateTable
CREATE TABLE "public"."external_identities" (
    "external_identity_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "type" "public"."ExternalIdentityType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_email" TEXT,
    "displayName" TEXT,
    "raw" JSONB,
    "sync_mode" "public"."SyncMode" NOT NULL DEFAULT 'AUTO',
    "user_id" TEXT,
    "membership_id" TEXT,
    "class_section_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("external_identity_id")
);

-- CreateTable
CREATE TABLE "public"."sync_runs" (
    "sync_run_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "status" "public"."SyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("sync_run_id")
);

-- CreateTable
CREATE TABLE "public"."sync_issues" (
    "sync_issue_id" TEXT NOT NULL,
    "sync_run_id" TEXT NOT NULL,
    "severity" "public"."SyncIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_issues_pkey" PRIMARY KEY ("sync_issue_id")
);

-- CreateIndex
CREATE INDEX "organization_integrations_organization_id_idx" ON "public"."organization_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_integrations_organization_id_provider_key" ON "public"."organization_integrations"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "external_identities_organization_id_type_idx" ON "public"."external_identities"("organization_id", "type");

-- CreateIndex
CREATE INDEX "external_identities_user_id_idx" ON "public"."external_identities"("user_id");

-- CreateIndex
CREATE INDEX "external_identities_membership_id_idx" ON "public"."external_identities"("membership_id");

-- CreateIndex
CREATE INDEX "external_identities_class_section_id_idx" ON "public"."external_identities"("class_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_organization_id_provider_type_external__key" ON "public"."external_identities"("organization_id", "provider", "type", "external_id");

-- CreateIndex
CREATE INDEX "sync_runs_organization_id_provider_started_at_idx" ON "public"."sync_runs"("organization_id", "provider", "started_at");

-- CreateIndex
CREATE INDEX "sync_issues_sync_run_id_severity_idx" ON "public"."sync_issues"("sync_run_id", "severity");

-- AddForeignKey
ALTER TABLE "public"."organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_identities" ADD CONSTRAINT "external_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_identities" ADD CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_identities" ADD CONSTRAINT "external_identities_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_identities" ADD CONSTRAINT "external_identities_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("class_section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sync_runs" ADD CONSTRAINT "sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sync_issues" ADD CONSTRAINT "sync_issues_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("sync_run_id") ON DELETE CASCADE ON UPDATE CASCADE;
