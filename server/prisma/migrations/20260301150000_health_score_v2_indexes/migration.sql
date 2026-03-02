-- Health Score V2: add indexes for efficient per-org activity aggregation
-- All queries run with ANY(orgIds::uuid[]) — these indexes support the groupBy + COUNT DISTINCT
-- round-trips in PlatformHealthService.computePlatformOverview()

-- Tests: support COUNT(DISTINCT creator_id) WHERE org IN orgIds AND created_at >= cutoff AND deleted_at IS NULL
CREATE INDEX "tests_org_created_at_deleted_at_idx" ON "tests" ("organization_id", "created_at", "deleted_at");

-- Assignments: support COUNT(DISTINCT created_by_id) WHERE org IN orgIds AND created_at >= cutoff
CREATE INDEX "assignments_org_created_at_idx" ON "assignments" ("organization_id", "created_at");

-- Invites: support SUM(used_count, max_uses) WHERE org IN orgIds AND created_at >= cutoff
CREATE INDEX "invites_org_created_at_idx" ON "invites" ("organization_id", "created_at");
