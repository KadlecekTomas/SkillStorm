# Guardian — bezpečnostní invarianty rodičovské role

Tento dokument shrnuje závazné bezpečnostní invarianty role `PARENT`.
Navazuje na [guardian-spec.md](./guardian-spec.md) (§9 Oprávnění rodiče) a
[guardian/etapa-a-analyza.md](./guardian/etapa-a-analyza.md).

## INV4 — PARENT nezískává generická RBAC oprávnění

**Invariant.** Uživatel s aktivní membership rolí `PARENT` **nesmí** získat žádné
generické RBAC oprávnění (`PermissionKey`) — a to **ani** přes `RolePermission`,
**ani** přes `UserPermission`, ani přes výchozí (default) sadu role. Při aktivní
roli `PARENT` jsou všechny generické role/user granty **ignorovány** (resolver)
nebo **zakázány** (write path).

Rodičovský přístup se vyhodnocuje **výhradně samostatnou vztahovou cestou** vůči
konkrétnímu dítěti (`GuardianStudentRelation` / `GuardianPermissionKey`), nikdy ne
přes obecnou roli `PARENT` a generický `PermissionKey`. To odpovídá požadavku
guardian-spec.md §9: *„Neomezuj rodičovský přístup pouze obecnou rolí PARENT.
Oprávnění musí být vyhodnocováno vůči konkrétnímu dítěti."*

> Stav implementace: relační vrstva (`GuardianStudentRelation`,
> `GuardianPermissionKey`, `/guardian/*`) je předmětem Etapy B a v době zavedení
> INV4 ještě není v kódu. INV4 do té doby garantuje, že rodič nemá **žádný**
> generický přístup — což je bezpečná výchozí pozice (deny-by-default).

### Vynucení (authoritative)

1. **Resolver — `RbacService.canUser`** (`server/src/modules/rbac/rbac.service.ts`).
   Jakmile je efektivní role requestu `PARENT`
   (`activeRole ?? membership.role`), vrací pro **libovolný** `PermissionKey`
   `false`, a to **před** vyhodnocením `UserPermission` i `RolePermission`. Tím je
   `UserPermission` prokazatelně **není obchvat** — user grant se nikdy neuplatní.
   Přes tento resolver prochází jak `RbacGuard`, tak výpočet pole `permissions`
   v `/auth/me`, takže PARENT kontext dostává vždy prázdnou generickou množinu.

2. **Defaults** (`rbac.defaults.ts`). `PARENT: []` — boot-sync ani seed nevytvoří
   žádné generické `role_permissions` pro PARENT.

### Write path (defense-in-depth)

`RbacPolicyService.grantUserPermission`
(`server/src/modules/rbac/rbac-policy.service.ts`):

- **Org-scoped grant** cílený na membership, jehož role v dané organizaci je
  **PARENT-only** (nemá žádnou non-PARENT roli), je **odmítnut 403**
  (`PARENT_GENERIC_PERMISSION_FORBIDDEN`). Multi-role uživatel (např.
  učitel-rodič) není blokován — jeho PARENT kontext jistí resolver.
- **Globální grant** se u zápisu **neblokuje** záměrně: multi-org učitel-rodič by
  jinak přišel o legitimní non-PARENT kontext v jiné organizaci. Jeho
  **neúčinnost pod aktivní PARENT rolí garantuje resolver** (bod 1). Globální
  `UserPermission` tedy může v DB existovat, ale v PARENT kontextu se nikdy
  nepromítne do efektivních oprávnění.

### Co invariant NEmění

- Legitimní `UserPermission` override pro **non-PARENT** role (TEACHER, DIRECTOR,
  …) funguje beze změny — resolver ho pro tyto role dál respektuje.
- `SUPERADMIN` / `DEVOPS` (systémové role) a `OWNER` (org) mají svoje bypass cesty
  beze změny.

### Regresní pokrytí

- Unit: `server/src/modules/rbac/tests/rbac.service.spec.ts` — PARENT odepřen i s
  org-scoped i globálním `UserPermission`; `canUserMultiple(PARENT)` = samé
  `false`; TEACHER override zachován.
- E2E: `server/test/e2e/guardian-permission-hardening.e2e-spec.ts` — INV4 body
  1, 2, 3, 5, 6. (Bod 4 „`/guardian/*` s VERIFIED vztahem" je vázán na Etapu B a
  bude doplněn spolu s relační vrstvou.)
- E2E: `server/test/e2e/auth.policy.e2e-spec.ts` — PARENT má prázdnou sadu
  `role_permissions`.
