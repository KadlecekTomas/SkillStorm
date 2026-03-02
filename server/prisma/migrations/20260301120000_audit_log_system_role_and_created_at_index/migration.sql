-- Add system_role column to audit_logs for GDPR-compliant actor tracing
-- This stores the caller's SystemRole at the time of the action (SUPERADMIN / DEVOPS / SUPPORT)
-- so platform mutations are attributed to the correct governance tier.
ALTER TABLE "audit_logs" ADD COLUMN "system_role" VARCHAR(50);

-- Add index on created_at to support efficient retention queries (anonymization cutoff scans)
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
