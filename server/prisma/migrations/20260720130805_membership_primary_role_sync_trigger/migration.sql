-- ============================================================================
-- Sync trigger (guardian Etapa A, docs/guardian/etapa-a-analyza.md §4.1):
-- legacy zápisové cesty (invite accept, seedy, test helpery, memberships
-- update) pracují jen s memberships.role. Tento trigger drží invariant
-- konstrukčně — s REPLACE sémantikou odpovídající single-role světu:
--   INSERT nebo skutečná změna role → primární role dostane aktivní
--   assignment, všechny ostatní assignments se soft-deletnou.
-- Multi-role cesty (MembershipRolesService) přidávají další role zápisem
-- přímo do membership_role_assignments — tam tento trigger nefiruje.
-- Update role na stejnou hodnotu (idempotentní seed upserty) je no-op,
-- aby reseed neodstřelil přidané role.
-- Finální stav transakce dál hlídá deferred CHECK trigger
-- membership_primary_role_guard_* (viz předchozí migrace).
-- ============================================================================
CREATE OR REPLACE FUNCTION "public".sync_membership_primary_role_assignment() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."role" IS NOT DISTINCT FROM OLD."role" THEN
    RETURN NEW;
  END IF;

  UPDATE "public"."membership_role_assignments"
  SET "deleted_at" = CURRENT_TIMESTAMP
  WHERE "membership_id" = NEW."membership_id"
    AND "role" <> NEW."role"
    AND "deleted_at" IS NULL;

  INSERT INTO "public"."membership_role_assignments"
    ("membership_role_assignment_id", "membership_id", "role")
  VALUES (gen_random_uuid(), NEW."membership_id", NEW."role")
  ON CONFLICT ("membership_id", "role") DO UPDATE SET "deleted_at" = NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "membership_primary_role_sync"
AFTER INSERT OR UPDATE OF "role" ON "public"."memberships"
FOR EACH ROW EXECUTE FUNCTION "public".sync_membership_primary_role_assignment();
