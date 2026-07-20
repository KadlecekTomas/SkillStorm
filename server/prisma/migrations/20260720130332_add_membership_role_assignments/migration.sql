-- AlterTable
ALTER TABLE "public"."memberships" ADD COLUMN     "last_active_role" "public"."OrganizationRole";

-- CreateTable
CREATE TABLE "public"."membership_role_assignments" (
    "membership_role_assignment_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role" "public"."OrganizationRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_membership_id" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "membership_role_assignments_pkey" PRIMARY KEY ("membership_role_assignment_id")
);

-- CreateIndex
CREATE INDEX "membership_role_assignments_role_idx" ON "public"."membership_role_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "membership_role_assignments_membership_id_role_key" ON "public"."membership_role_assignments"("membership_id", "role");

-- AddForeignKey
ALTER TABLE "public"."membership_role_assignments" ADD CONSTRAINT "membership_role_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("membership_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Backfill: každý existující membership dostane právě jeden assignment své
-- primární role (včetně soft-deleted membershipů — viditelnost řídí
-- memberships.deleted_at). Nic se nepřepisuje ani nemaže.
-- ============================================================================
INSERT INTO "public"."membership_role_assignments"
  ("membership_role_assignment_id", "membership_id", "role", "created_at")
SELECT gen_random_uuid(), m."membership_id", m."role", CURRENT_TIMESTAMP
FROM "public"."memberships" m;

-- ============================================================================
-- Invariant (guardian Etapa A, docs/guardian/etapa-a-analyza.md §4.1):
--   1. nesmazaný membership má nesmazaný assignment své primární role,
--   2. STUDENT je exkluzivní — má-li membership aktivní STUDENT assignment,
--      nesmí mít žádný další aktivní assignment.
-- DEFERRABLE INITIALLY DEFERRED: servisní transakce smí membership a assignment
-- zapsat ve více krocích; kontrola proběhne při COMMIT.
-- Pozn.: testovací wipy běží se session_replication_role=replica → trigger se
-- na ně nevztahuje (stejný vzor jako SUBMISSION_LOCKED).
-- ============================================================================
CREATE OR REPLACE FUNCTION "public".enforce_membership_primary_role() RETURNS trigger AS $$
DECLARE
  v_membership_id TEXT;
  v_role "public"."OrganizationRole";
  v_deleted TIMESTAMP(3);
  v_student_cnt INT;
  v_total_cnt INT;
BEGIN
  IF TG_TABLE_NAME = 'memberships' THEN
    v_membership_id := NEW."membership_id";
  ELSIF TG_OP = 'DELETE' THEN
    v_membership_id := OLD."membership_id";
  ELSE
    v_membership_id := NEW."membership_id";
  END IF;

  SELECT "role", "deleted_at" INTO v_role, v_deleted
  FROM "public"."memberships" WHERE "membership_id" = v_membership_id;

  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "public"."membership_role_assignments"
    WHERE "membership_id" = v_membership_id
      AND "role" = v_role
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'MEMBERSHIP_PRIMARY_ROLE_VIOLATION: membership % has no active assignment for primary role %',
      v_membership_id, v_role;
  END IF;

  SELECT COUNT(*) FILTER (WHERE "role" = 'STUDENT'), COUNT(*)
  INTO v_student_cnt, v_total_cnt
  FROM "public"."membership_role_assignments"
  WHERE "membership_id" = v_membership_id AND "deleted_at" IS NULL;

  IF v_student_cnt > 0 AND v_total_cnt > 1 THEN
    RAISE EXCEPTION 'STUDENT_ROLE_EXCLUSIVE_VIOLATION: membership % combines STUDENT with other active roles',
      v_membership_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "membership_primary_role_guard_membership"
AFTER INSERT OR UPDATE OF "role", "deleted_at" ON "public"."memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public".enforce_membership_primary_role();

CREATE CONSTRAINT TRIGGER "membership_primary_role_guard_assignment"
AFTER INSERT OR UPDATE OR DELETE ON "public"."membership_role_assignments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public".enforce_membership_primary_role();
