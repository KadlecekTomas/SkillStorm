-- Enforce invariant between organization type and status.
-- THIS STATE MUST BE IMPOSSIBLE:
-- - PRIVATE or COMMUNITY organization with status = PENDING
--
-- On existing data, normalize such rows to ACTIVE to match domain rule:
-- PRIVATE/COMMUNITY are created as ACTIVE, only SCHOOL can be PENDING.

UPDATE "public"."organizations"
SET "status" = 'ACTIVE'
WHERE "status" = 'PENDING'
  AND "type" IN ('PRIVATE', 'COMMUNITY');

ALTER TABLE "public"."organizations"
ADD CONSTRAINT "organizations_pending_school_only"
CHECK (
  "status" <> 'PENDING'
  OR "type" = 'SCHOOL'
);

