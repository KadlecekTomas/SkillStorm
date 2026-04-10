-- Consolidate the current-academic-year invariant to a single canonical partial unique index.
-- Older deployments may still carry "academic_years_one_current_per_org", which ignores deleted_at
-- and can incorrectly block a new current year after soft-deleting the previous one.

DROP INDEX IF EXISTS "public"."academic_years_one_current_per_org";

CREATE UNIQUE INDEX IF NOT EXISTS "academic_year_single_current_per_org"
  ON "public"."academic_years" ("organization_id")
  WHERE "isCurrent" = true AND "deleted_at" IS NULL;
