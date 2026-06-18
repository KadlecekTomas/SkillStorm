-- CreateIndex
CREATE INDEX "organization_integrations_provider_customer_id_idx" ON "public"."organization_integrations"("provider", "customer_id");

-- MVP tenant invariant: a given Google Workspace tenant (customer_id) may be
-- connected to at most ONE organization. Partial unique over non-null,
-- non-deleted rows (NULL customer_id stays unconstrained — many orgs may be
-- connected before a tenant id is known).
CREATE UNIQUE INDEX "organization_integrations_provider_customer_unique"
  ON "public"."organization_integrations" ("provider", "customer_id")
  WHERE "customer_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Per-organization sync lock: at most one RUNNING SyncRun per (organization,
-- provider). Scoped per org, so different schools sync in parallel.
CREATE UNIQUE INDEX "sync_run_single_running_per_org"
  ON "public"."sync_runs" ("organization_id", "provider")
  WHERE "status" = 'RUNNING';
