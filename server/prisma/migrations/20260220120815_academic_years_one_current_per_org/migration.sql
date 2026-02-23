-- Pre-migration safety: fix legacy/race data so at most one row per org has "isCurrent" = true.
-- For any org with multiple current years, keep the newest by created_at and set others to "isCurrent" = false.
WITH bad_orgs AS (
  SELECT organization_id
  FROM academic_years
  WHERE "isCurrent" = true
  GROUP BY organization_id
  HAVING COUNT(*) > 1
),
keepers AS (
  SELECT DISTINCT ON (ay.organization_id) ay."academic_year_id"
  FROM academic_years ay
  INNER JOIN bad_orgs bo ON ay.organization_id = bo.organization_id
  WHERE ay."isCurrent" = true
  ORDER BY ay.organization_id, ay.created_at DESC
)
UPDATE academic_years
SET "isCurrent" = false
WHERE "isCurrent" = true
  AND organization_id IN (SELECT organization_id FROM bad_orgs)
  AND "academic_year_id" NOT IN (SELECT "academic_year_id" FROM keepers);

-- Enforce at most one current academic year per organization (DB-level invariant).
-- Protects against race conditions; partial unique index.
CREATE UNIQUE INDEX "academic_years_one_current_per_org"
ON "academic_years" ("organization_id")
WHERE "isCurrent" = true;
