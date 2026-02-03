-- Enforce invariant: exactly one active (isCurrent=true) academic year per organization.
-- Index name aligned with spec: academic_years_one_active_per_org_idx.
-- Column in DB is "isCurrent" (Prisma default for AcademicYear.isCurrent).

DROP INDEX IF EXISTS "public"."academic_years_one_current_per_org";

CREATE UNIQUE INDEX "academic_years_one_active_per_org_idx"
  ON "public"."academic_years"("organization_id")
  WHERE "isCurrent" = true;
