-- PART 1: Submission.organizationId (DB-level org boundary)
-- Step 1: Add column (nullable for backfill)
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Step 2: Backfill from assignment (authoritative source: assignment owns the org context)
UPDATE "submissions" s
SET "organization_id" = a."organization_id"
FROM "assignments" a
WHERE a."assignment_id" = s."assignment_id"
  AND s."organization_id" IS NULL;

-- Step 3: Enforce NOT NULL (fail if any row still null)
ALTER TABLE "submissions" ALTER COLUMN "organization_id" SET NOT NULL;

-- Step 4: FK to organizations
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Index for org-scoped queries
CREATE INDEX IF NOT EXISTS "submissions_organization_id_idx" ON "submissions"("organization_id");

-- Step 6: Replace unique with org-scoped unique (drop old index, add new)
DROP INDEX IF EXISTS "submissions_assignment_id_student_id_attempt_no_key";
CREATE UNIQUE INDEX "submissions_organization_id_student_id_assignment_id_attempt_no_key"
  ON "submissions"("organization_id", "student_id", "assignment_id", "attempt_no");

-- Step 7: Ensure assignments can be referenced by (assignment_id, organization_id)
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assignment_id_organization_id_key"
  UNIQUE ("assignment_id", "organization_id");

-- Step 8: Replace single-column FK with composite FK to enforce org match
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_assignment_id_fkey";
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_organization_id_fkey"
  FOREIGN KEY ("assignment_id", "organization_id")
  REFERENCES "assignments"("assignment_id", "organization_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Response timestamps (for verifier: "answers changed after submit")
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
