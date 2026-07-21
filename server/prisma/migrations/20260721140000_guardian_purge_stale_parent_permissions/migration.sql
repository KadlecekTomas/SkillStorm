-- Guardian audit (docs/guardian.md §1): role PARENT nemá mít žádná školní
-- oprávnění. RBAC default sync je pouze aditivní (nemaže zastaralé řádky),
-- takže DB, která bootovala s dřívějšími PARENT defaults (VIEW_RESULTS,
-- VIEW_SUBMISSIONS), by tyto globální role_permission řádky ponechala a ty
-- by přebily nový prázdný default. Odstraníme je — idempotentně, jen
-- globální (organization_id IS NULL) řádky role PARENT.
--
-- Bezpečnost: maže výhradně řádky role='PARENT' a organization_id IS NULL.
-- Případné manuální org-scoped override (organization_id != NULL) zůstávají
-- nedotčené a spravuje je škola/admin explicitně.
DELETE FROM "role_permissions"
WHERE "role" = 'PARENT'
  AND "organization_id" IS NULL;
