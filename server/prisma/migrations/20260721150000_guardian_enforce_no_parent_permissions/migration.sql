-- Guardian bezpečnostní invariant (docs/guardian.md §3): role PARENT nesmí mít
-- ŽÁDNÁ generická RBAC oprávnění — ani globální, ani organization-scoped.
-- Veškerý rodičovský přístup jde výhradně přes vztahově autorizované
-- /guardian/* endpointy (VERIFIED vztah + GuardianPermissionKey), oddělené
-- od generického RBAC.
--
-- Předchozí migrace 20260721140000 mazala jen globální (organization_id IS
-- NULL) řádky; org-scoped override by rodiče na @Permission endpointu znovu
-- propustil. Tato migrace invariant dotahuje:
--   1) smaže VŠECHNY role_permissions role PARENT (bez ohledu na org),
--   2) přidá CHECK constraint, který jakékoli budoucí vložení PARENT řádku
--      odmítne na úrovni DB — neobejde ho žádný seed, sync, admin API,
--      import ani ruční SQL.
--
-- Idempotence: DELETE je bezpečné opakovat; CHECK constraint se přidává jen
-- pokud ještě neexistuje.

-- 1) Purge všech PARENT řádků (globální i org-scoped).
DELETE FROM "role_permissions" WHERE "role" = 'PARENT';

-- 2) Strukturální invariant na úrovni DB.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_no_parent_role'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_no_parent_role"
      CHECK ("role" <> 'PARENT');
  END IF;
END $$;
