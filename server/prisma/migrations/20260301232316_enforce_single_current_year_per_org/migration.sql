-- Enforce at most one non-deleted current academic year per organization.
-- Partial unique index: only rows with isCurrent=true AND deleted_at IS NULL are covered.
-- Rows with isCurrent=false or deleted_at IS NOT NULL can be duplicated freely.
-- The activate() transaction (clear others → set one) is safe because the deactivate
-- step runs first, releasing the slot before the new row claims it.
CREATE UNIQUE INDEX "academic_year_single_current_per_org"
  ON "public"."academic_years" ("organization_id")
  WHERE "isCurrent" = true AND "deleted_at" IS NULL;
