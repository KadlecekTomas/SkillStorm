# Guardian — architektura a bezpečnostní model

Souhrnný dokument guardian vertikály (Etapa D). Dílčí návrhy: `docs/guardian/etapa-a-analyza.md`, `docs/guardian/etapa-b-stop2-navrh.md`, `docs/guardian/etapa-c-stop3-navrh.md`. Tento dokument je bude postupně zastřešovat (architektura, provenance sémantika pro učitele) — začíná RBAC auditem Etapy D.

---

## 1. RBAC průsečíkový audit (21. 7. 2026)

**Metoda:** kanonický zdroj oprávnění je `server/src/modules/rbac/rbac.defaults.ts` (role → default `PermissionKey[]`; RbacGuard vyhodnocuje `@Permission(...)` na endpointech, OWNER má bypass). Pro každou roli a každý jí přiřazený klíč byly dohledány všechny endpointy klíčem gatované (`@Permission(PermissionKey.X)` napříč controllery) a u nich zkontrolována služební vrstva: zda po průchodu RBAC dochází k zúžení dle role/vztahu, nebo zda platí vzor „kdo není STUDENT/TEACHER, dostane školní pohled".

**Kontext:** role PARENT se stala reálně dosažitelnou v Etapě B (párování). Její defaults `[VIEW_RESULTS, VIEW_SUBMISSIONS]` pocházejí z Etapy A — z doby, kdy žádný rodič neexistoval. Dvě díry tohoto typu byly nalezeny a opraveny už v Etapě C (`getStudentResult`, `submissions.findOne`); tento audit systematicky prošel zbytek průsečíku.

### 1.1 Tabulka Role × Permission × Verdikt

Školní role (OWNER/DIRECTOR/TEACHER) drží klíče záměrně — verdikty se soustředí na služební scoping. STUDENT a PARENT jsou rizikové průsečíky.

| Role | Permission | Verdikt | Poznámka |
|---|---|---|---|
| OWNER | `*` (bypass) | ✅ OK | Invariant vlastníka; RbacGuard permission checky přeskakuje, tenant guardy platí. |
| DIRECTOR | TEACHER sada + DIRECTOR_EXTRA | ✅ OK | Org-wide dle záměru; služební vrstvy tenant-scopují (`withOrg`, `assertTenantWhere`). |
| TEACHER | CREATE/EDIT/MANAGE_TESTS, ASSIGN_TESTS | ✅ OK | Class-scope přes `teacherClassScope` (homeroom NEBO úvazek) v results/submissions/classrooms. |
| TEACHER | VIEW_RESULTS / VIEW_SUBMISSIONS | ✅ OK | `tests.results` i `submissions.findAll` zužují na třídy učitele. |
| TEACHER | INVITE_STUDENTS | ✅ OK | Guardian párování (Etapa B) scopováno na vlastní třídy. |
| STUDENT | VIEW_RESULTS | ⚠️ OK s výhradou | Všechny dotčené služby zužují na sebe (`studentId = membership.id`); výhrada: `GET /metrics/summary` — viz N1. |
| STUDENT | VIEW_TEST_OVERVIEW | ✅ OK | Jen číselníky předmětů (`/subjects`), bez citlivého obsahu. |
| STUDENT | VIEW_SUBMISSIONS | ✅ OK | `findAll`/`findOne` vynucují vlastní `studentId`. |
| STUDENT | VIEW_OWN_ASSIGNMENTS | ✅ OK | Own-scoped už názvem i implementací (`/assignments/my`). |
| PARENT | VIEW_RESULTS | ❌ **DÍRY D1–D3, D5** | Viz nálezy níže — služby mají vzor „ne-STUDENT ⇒ školní pohled". |
| PARENT | VIEW_SUBMISSIONS | ❌ **DÍRA D4** | `submissions.findAll` PARENTa nezužuje (a respektuje `?studentId=` filtr). |
| PARENT | VIEW_RESULTS (opravené případy) | ✅ opraveno v Etapě C | `tests.getStudentResult` a `submissions.findOne` → 403 pro PARENT. |
| PARENT | — (guardian API) | ✅ OK | `/guardian/*` nepoužívá PermissionKey — autorizace je vztahová per dítě (VERIFIED + `GuardianPermissionKey`), okamžitá revokace. |

### 1.2 Nálezy (POUZE dokumentace — oprava je samostatný krok)

Aktér u všech: **rodič s dokončeným párováním (aktivní role PARENT)**, bez jakéhokoli vztahu k dotčeným datům.

| # | Závažnost | Endpoint | Problém |
|---|---|---|---|
| **D1** | **KRITICKÁ** | `GET /tests/:id` (`tests.findOne`) | Ne-STUDENT větev vrací **učitelskou projekci s `questions: true` — tedy kompletní klíč správných odpovědí** kteréhokoli testu v organizaci. Rodič si může přečíst řešení testu, který jeho dítě zítra píše. |
| **D2** | vysoká | `GET /tests/:id/results` (`tests.results`) | Zužuje jen STUDENT (na sebe) a TEACHER (na třídy). PARENT propadne bez zúžení → **agregované výsledky celého testu včetně jmen a skóre všech žáků**. |
| **D3** | střední | `GET /tests` (`tests.findAll`) | STUDENT větev filtruje na zadané testy; PARENT propadne do školního listingu → **celý katalog testů organizace** (list projekce bez otázek). |
| **D4** | vysoká | `GET /submissions` (`submissions.findAll`) | TEACHER scope, STUDENT na sebe; PARENT bez zúžení, navíc else-větev **respektuje `?studentId=`** → výpis odevzdání libovolného žáka v org. |
| **D5** | střední | `GET /stats/overview` (`getOrgOverview`) | STUDENT/TEACHER mají zúžený scope; PARENT propadne do org-wide větve → **celoorganizační průměry a počty** (ředitelský pohled). |
| **N1** | nízká | `GET /metrics/summary` | Počítá `FORBIDDEN_ACCESS` audit záznamy **bez org filtru** — kdokoli s VIEW_RESULTS (i STUDENT) vidí platformní číslo. Mimo guardian scope, ale patří do stejného úklidu. |

**Bez nálezu (ověřeno):** `enrollments.listByClassSection` (explicitní fallthrough deny), `class-sections` list/detail/org-subjects (deny pro role < DIRECTOR mimo TEACHER/STUDENT větve), `analytics.studentTimeline` (else → 403), `stats dashboards` student/teacher/director (explicitní role checky), `academic-years` čtení (org metadata — PARENT je potřebuje pro lištu školního roku, obsahově neškodné), `guardian-admin` endpointy (INVITE_STUDENTS + teacher scope).

### 1.3 Kořenová příčina a doporučený směr opravy (rozhodnout před implementací)

Vzor selhání je vždy stejný: služby větví **negativně** („STUDENT dostane své, TEACHER třídy, *zbytek je škola*") a PARENT — role z Etapy A bez konzumentů — zdědil školní fallback. Možnosti opravy:

- **(a) Vyprázdnit PARENT defaults** na klíče, které rodičovský klient skutečně potřebuje (dnes fakticky jen čtení `academic-years` pro lištu roku; rodinný prostor jede přes `/guardian/*`), tj. `PARENT: []` + přesunout academic-years pod vlastní benigní klíč nebo výjimku. Nejmenší plocha, doporučeno.
- **(b) Pozitivní větvení ve službách** (výčet rolí, deny default) — správné dlouhodobě, ale dotýká se mnoha služeb.
- Obojí doplnit regresním e2e: „PARENT × každý dotčený endpoint → 403" (rozšíření matice z Etapy C).

*Oprava se provede v samostatném kroku Etapy D po schválení tohoto auditu.*

---

## 2. RBAC hardening — oprava (21. 7. 2026, security commit)

**Zvolený směr (schváleno):** kombinace (a) prázdné PARENT defaults + (b) pozitivní allowlisty ve službách. Dvojitá obrana: RbacGuard blokuje PARENTa na každém `@Permission` endpointu (defaults `[]`), a služby navíc denyují neznámé role explicitně (belt-and-suspenders pro budoucí role).

### 2.1 Stav nálezů před/po

| # | Endpoint | Před | Po | Uzavřeno čím |
|---|---|---|---|---|
| D1 | `GET /tests/:id` | rodič dostal učitelskou projekci vč. `correctAnswer` | 403 | prázdné defaults + `findOne` pozitivní allowlist (`isSchoolStaffRole`) |
| D2 | `GET /tests/:id/results` | rodič viděl výsledky celého testu | 403 | prázdné defaults + `results` allowlist (STUDENT/škola) |
| D3 | `GET /tests` | rodič viděl katalog testů | 403 | prázdné defaults + `findAll` allowlist |
| D4 | `GET /submissions` | rodič listoval odevzdání, i s `?studentId=` | 403 | prázdné defaults + `findAll` allowlist; `?studentId=` jen pro školu |
| D5 | `GET /stats/overview` | rodič viděl org průměry | 403 | prázdné defaults + `getOrgOverview` allowlist |
| N1 | `GET /metrics/summary` | kdokoli s VIEW_RESULTS (i žák) viděl platformní metriku bez org filtru | 403 pro školní role, 200 jen platformní (SUPERADMIN/DEVOPS/SUPPORT) | přesun z `@Permission(VIEW_RESULTS)` na `PlatformAccessGuard` + `@AllowAnyOrgStatus` |

Opravy z Etapy C (`getStudentResult`, `submissions.findOne`) zůstávají a jsou nezávisle pokryté.

### 2.2 Kořenová příčina

Služby větvily **negativně** — „STUDENT dostane své, TEACHER třídy, *zbytek je škola*". PARENT (role z Etapy A bez konzumentů) zdědil školní fallback i klíče `VIEW_RESULTS`/`VIEW_SUBMISSIONS` v defaults. Oprava překlápí větvení na **pozitivní allowlist** (`isSchoolStaffRole` v `shared/access.utils.ts`): role mimo výčet končí 403, nikdy školním fallbackem.

### 2.3 Změněné permissions

- `rbac.defaults.ts`: `PARENT: [VIEW_RESULTS, VIEW_SUBMISSIONS]` → `PARENT: []`.
- **Produkční past:** RBAC default sync je pouze aditivní (nemaže zastaralé řádky). Migrace `20260721140000_guardian_purge_stale_parent_permissions` idempotentně smaže globální (`organization_id IS NULL`) `role_permissions` řádky role PARENT, aby DB nastartovaná se starými defaults nepřebila prázdný default. Org-scoped override (`organization_id != NULL`) zůstávají nedotčené.

### 2.4 Změněné služby (pozitivní allowlist)

- `tests.service.ts`: `findOne` (D1), `results` (D2), `findAll` (D3).
- `submissions.service.ts`: `findAll` (D4) — `?studentId=` filtr jen pro `isSchoolStaffRole`.
- `stats.service.ts`: `getOrgOverview` (D5).
- `metrics.controller.ts`: `summary` (N1) — `PlatformAccessGuard` + `@RequirePlatformAccess(READ)` + `@AllowAnyOrgStatus`.
- Nový helper `isSchoolStaffRole(role)` v `shared/access.utils.ts`.
- Klient: `dashboard-layout.tsx` — lišta školního roku a `useAcademicYears` fetch vypnuté pro PARENT (rodič nemá školní klíče; kontext roku nese karta dítěte). `/academic-years` se rodiči neposkytuje vůbec — užší guardian endpoint není potřeba.

### 2.5 Testovací důkaz

`test/e2e/guardian-rbac-hardening.e2e-spec.ts`:
- D1 PARENT → 403 vč. přímého ID testu i cizí org; odpověď neobsahuje `correctAnswer` ani text otázky.
- D2+D3, D4 (vč. `?studentId=` cizího žáka), D5+N1 → 403; metrics/summary 200 jen SUPERADMIN.
- PARENT rodinný prostor (`/guardian/*`) dál 200 — nezávislý na školních klíčích.
- STUDENT drží svůj rozsah (detail bez klíče, jen vlastní submissions), TEACHER jen své třídy, DIRECTOR/OWNER org-wide.
- Invariant test: `isPermissionAllowedByDefault(PARENT, *)` je `false` pro všechny klíče.

### 2.6 Další výskyty stejného antipatternu (cílený sweep)

Prohledány všechny služby používající roli. **Bez dalšího nálezu** — zbytek už používá pozitivní allowlist s deny-fallthrough: `enrollments.listByClassSection`, `class-sections` (list/detail/org-subjects), `analytics.studentTimeline` (else → 403), `stats` dashboardy (explicitní role checky), `teachers`/`teacher-access` (DIRECTOR+ required), `learning-materials` (TEACHER+ required), `audit-data-scope` (DIRECTOR/OWNER same-org, jinak null), `student` detail (StudentAccessGuard, deny fallthrough). Guardian API (`/guardian/*`) nepoužívá PermissionKey — vztahová autorizace per dítě.

---

## 3. Bezpečnostní invariant — PARENT bez generických RBAC oprávnění (21. 7. 2026)

### 3.1 Přesná podoba invariantu

> Role `PARENT` nesmí mít **žádný** záznam v `role_permissions` — ani globální (`organization_id IS NULL`), ani organization-scoped. Veškerý rodičovský přístup jde **výhradně** přes vztahově autorizované `/guardian/*` endpointy (VERIFIED `GuardianStudentRelation` + `GuardianPermissionKey` per dítě), oddělené od generického RBAC. Org administrátor nesmí PARENT oprávnění vytvořit ani obnovit.

Vynuceno **třemi vrstvami**:
1. **DB CHECK constraint** `role_permissions_no_parent_role` (`CHECK (role <> 'PARENT')`) — strukturální, neobejde ho seed, sync, admin API, import ani ruční SQL.
2. **Aplikační guard** `roleAllowsGenericPermissions(role)` (kanonicky v `rbac.defaults.ts`, konstanta `ROLES_WITHOUT_GENERIC_RBAC = [PARENT]`) na všech write cestách — srozumitelná 403 chyba před DB.
3. **Prázdné defaults** `PARENT: []` (§2) — RbacGuard PARENTa neprozkoumá na žádném `@Permission` endpointu.

### 3.2 Nalezené write cesty pro RolePermission (všechny ošetřené)

| Write cesta | Soubor | Ošetření |
|---|---|---|
| Admin API service | `rbac-policy.service.ts` `grantRolePermission` | guard → `ForbiddenException` pro PARENT (revoke PARENT je no-op, nic nevytváří) |
| Boot default sync | `rbac-default-sync.service.ts` | `continue` pro role bez generického RBAC |
| Prisma seed | `prisma/seed/rbac.seed.ts` | `continue` pro role bez generického RBAC |
| Klientské zrcadlo (UI gating, ne autoritativní) | `client/src/types/permissions.ts` | `ROLE_PERMISSION_MATRIX.PARENT = []`, `roleHome.PARENT = /app/family` |

`RbacPolicyService` je exportovaná z `rbac.module`, ale žádný controller ji zatím nevystavuje — guard je preventivní pro budoucí admin UI/API. Žádný import/CSV cesta pro RolePermission neexistuje.

### 3.3 Migrace before/after (ověřeno)

Migrace `20260721150000_guardian_enforce_no_parent_permissions`: `DELETE FROM role_permissions WHERE role = 'PARENT'` (bez org filtru — maže globální i org-scoped) + idempotentní `ADD CONSTRAINT ... CHECK (role <> 'PARENT')`. Předchozí `20260721140000` (jen globální) zůstává v historii; tato ji dotahuje.

Izolovaný test na čisté DB:
```
BEFORE enforcement — global PARENT rows: 2   (org-scoped by CHECK dřív nešlo vložit; DELETE nemá org filtr)
AFTER enforcement  — PARENT rows (any org): 0
CHECK present: 1
idempotentní re-run migračního SQL: OK (DO bez chyby)
```
Přímé inserty po migraci (ověřeno psql): globální PARENT → `ERROR: violates check constraint role_permissions_no_parent_role`; org-scoped PARENT → stejná chyba; STUDENT → `INSERT 0 1` (constraint se ho netýká).

### 3.4 Testovací důkaz

`guardian-rbac-hardening.e2e-spec.ts`:
- INV1: DB CHECK odmítne PARENT `role_permission` (globální i org-scoped) přes `prisma.$executeRaw`.
- INV2: po bootu (seed + default sync) je `count(role_permissions WHERE role=PARENT) === 0`.
- INV3: `RbacPolicyService.grantRolePermission(PARENT, …)` hodí výjimku a nic nevytvoří; STUDENT grant guardem projde.
- D1–D5 + N1 → 403 pro PARENT (beze změny); `/guardian/*` (children, overview) dál 200.
- Unit `rbac.defaults.invariant.spec.ts`; `isPermissionAllowedByDefault(PARENT, *) === false`.

### 3.5 Schema / dokumentace

- `schema.prisma`: komentář u `OrganizationRole.PARENT` vysvětluje, že PARENT nemá generická RBAC oprávnění a autorizace je relationship-based (`/guardian/*`). `PermissionKey` enum je beze změny (PARENT žádný klíč nedrží). `GuardianPermissionKey` je oddělený enum vztahových oprávnění — kolize názvu `VIEW_RESULTS`/`VIEW_ASSIGNMENTS` mezi oběma enumy je záměrná a nesouvisí (různé namespace).
- `docs/guardian/etapa-a-analyza.md` zůstává historickým záznamem stavu Etapy A (tehdy PARENT měl VIEW_RESULTS/VIEW_SUBMISSIONS) — není to tvrzení o současnosti.

### 3.6 Stav (RolePermission cesta)

Invariant §3 (RolePermission) je vynucen na DB + aplikační + defaults vrstvě;
všechny write cesty ošetřené; migrace idempotentní s ověřeným before/after.
Tato sekce pokrývá pouze `RolePermission` cestu — `UserPermission` cestu a
autoritu `activeRole` doplňuje §4. Souhrnný stav a merge verdikt viz §4.8 a PR.

---

## 4. Doplnění — UserPermission cesta a resolver (INV4, 21. 7. 2026)

§3 uzavřela `RolePermission` cestu (DB CHECK + guard + prázdné defaults). Zbýval ale **druhý, nezávislý zdroj generických oprávnění: `user_permissions`** a samotný resolver `RbacService.canUser`, který `role_permissions` ani DB CHECK z §3 neřeší. Tato sekce ho uzavírá.

### 4.1 Nalezený obchvat

`RbacService.canUser` vyhodnocoval `UserPermission(allowed=true)` **před** resolucí role a rovnou vracel `true`. Uživatel s aktivní rolí `PARENT` a `UserPermission` — **globálním (`organization_id IS NULL`) i org-scoped** — tak získal generické oprávnění (např. `VIEW_RESULTS`), přestože §3 blokuje pouze `role_permissions`. `user_permissions` nemá DB CHECK z §3 (constraint je na `role_permissions`), takže obchvat obcházel i strukturální vrstvu.

### 4.2 Oprava (authoritative — resolver)

`RbacService.canUser`: brána spadne, pokud je `PARENT` buď efektivní role requestu (`activeRole`), **nebo** primární role membershipu z DB (`membership.role`) — a to **před** vyhodnocením `UserPermission`, `RolePermission` i defaults. Tím `UserPermission` prokazatelně **není obchvat** — user grant se v PARENT kontextu nikdy neuplatní.

**DB-autoritativní gate.** Díky `@@unique([userId, organizationId])` má uživatel v organizaci právě jednu membership; PARENT-only uživatel má vždy `membership.role = PARENT` (PARENT je u multi-role personálu pouze ne-primární assignment, nikdy primární role). Kontrola `membership.role` proto uzavírá i případný **stale nebo klientem podvržený `activeRole`**: eskalace PARENT-only membershipu na generická oprávnění není možná, protože autoritou je záznam v DB, ne token. Multi-role učitel-rodič (primární role TEACHER + PARENT assignment) není dotčen — jeho brána spadne jen v PARENT kontextu (`activeRole = PARENT`).

Přes tento resolver prochází jak `RbacGuard`, tak výpočet pole `permissions` v `/auth/me`, takže aktivní PARENT role dostává vždy **prázdnou generickou množinu**. To doplňuje trojvrstvou obranu z §3.1 o čtvrtou, autoritativní vrstvu na úrovni vyhodnocení.

### 4.3 Write path — `user_permissions` (defense-in-depth)

`RbacPolicyService.grantUserPermission` (dosud jistil jen `grantRolePermission`):

- **Org-scoped grant** cílený na membership, jehož všechny role v dané organizaci jsou relační-only (typicky **PARENT-only**, tj. `roleAllowsGenericPermissions` je `false` pro všechny), je **odmítnut 403** (`PARENT_GENERIC_PERMISSION_FORBIDDEN`). Používá stejný model jako `grantRolePermission` (`roleAllowsGenericPermissions`). Multi-role uživatel (učitel-rodič) není blokován — jeho PARENT kontext jistí resolver (§4.2).
- **Globální grant** se u zápisu **neblokuje** záměrně: u multi-org učitele-rodiče by globální blok rozbil legitimní non-PARENT kontext v jiné organizaci. Globální `UserPermission` tedy **může** v DB existovat, ale při aktivní PARENT roli je **autoritativně neúčinný** díky resolveru (§4.2).

### 4.4 Co invariant NEmění

- Legitimní `UserPermission` override pro **non-PARENT** role (TEACHER, DIRECTOR, …) funguje beze změny — resolver ho pro tyto role dál respektuje.
- `SUPERADMIN` / `DEVOPS` (systémové role) a `OWNER` (org) mají svoje bypass cesty beze změny.

### 4.5 Testovací důkaz

- Unit: `rbac.service.spec.ts` — aktivní PARENT odepřen i s org-scoped i globálním `UserPermission`; `canUserMultiple(PARENT)` = samé `false`; **TEACHER override zachován**.
- E2E: `guardian-rbac-hardening.e2e-spec.ts` (sekce „INV4 — UserPermission cesta") —
  PARENT + org-scoped `UserPermission(VIEW_RESULTS)` → učitelský endpoint 403;
  PARENT + globální `UserPermission(VIEW_RESULTS)` → 403; `/auth/me` PARENT má
  nulová generická `permissions`; PARENT + VERIFIED guardian vztah → `/guardian/*` 200;
  PARENT bez vztahu / PENDING / cizí dítě → 403; TEACHER override funguje; write
  org-scoped grant PARENT-only → aplikační 403.

### 4.7 Autorita `activeRole` (role-context)

`activeRole` (efektivní role requestu) je bezpečná pouze tehdy, když je to role,
kterou uživatel v dané organizaci **skutečně vlastní**. To se ověřuje na dvou
místech, se dvěma vrstvami:

**Kanonické validační místo — `jwt.strategy.validate`** (`server/src/auth/jwt.strategy.ts`).
Při každém requestu se z `payload.membershipId` načte membership
(`deletedAt: null`) a její `roleAssignments` (`deletedAt: null`). Pokud token nese
`payload.activeRole`, vyžaduje se, aby byla **aktivním assignmentem** té
membership; jinak **401 `ROLE_CONTEXT_REVOKED`**. Bez `activeRole` se použije
`membership.role`. Odebrání role (revokace assignmentu) se tak projeví **na
příštím requestu** i pro živý token — stale/podvržený `activeRole` neprojde,
protože JWT je podepsaný a strategie ho znovu ověřuje proti DB. Správná
organizace je zajištěna vazbou `membershipId → organizationId`.

**Defense-in-depth — `RbacService.canUser`.** Resolver navíc nezávisle ověří
`activeRole` proti DB rolím: sestaví `authorizedRoles = {membership.role} ∪
{aktivní roleAssignments.role}` (obojí `deletedAt: null`, pro daný
`userId + organizationId`) a pokud `activeRole ∉ authorizedRoles`, vrátí `false`
**před** vyhodnocením UserPermission, RolePermission i defaults. Žádná klientem
dodaná role není důvěřována bez kontroly v DB. Org isolation je strukturální:
membership se načítá pro daný `userId + organizationId`, jeho assignmenty patří
téže organizaci — assignment z organizace A neautorizuje `activeRole` v
organizaci B.

Tím je pokryto (unit + e2e):

- `STUDENT → TEACHER`, `TEACHER → DIRECTOR`, `TEACHER → OWNER`, `PARENT → TEACHER`
  přes stale/podvržený `activeRole` → **zamítnuto** (401 v jwt.strategy nebo
  `false` v canUser). OWNER bypass se u podvržené role nikdy nedostane ke slovu.
- Legitimní multi-role učitel-rodič: `activeRole` musí být v jeho aktivních
  assignmentech — smí `TEACHER` kontext (plná oprávnění i override) i `PARENT`
  kontext (generická oprávnění prázdná, `/guardian/*` jen pro VERIFIED vazbu).
- PARENT-only membership nelze eskalovat: `authorizedRoles = {PARENT}`, takže
  jakákoli non-PARENT `activeRole` je mimo množinu; navíc PARENT brána (§4.2).

> „DB-authoritative" v tomto dokumentu znamená právě toto: každá explicitní
> `activeRole` je ověřena proti aktuálním DB rolím uživatele ve správné
> organizaci (jwt.strategy jako primární, canUser jako druhá obrana).

### 4.8 Stav

Kombinovaný invariant: DB CHECK + guard + prázdné defaults (§3) **a** resolver
blokace + `user_permissions` write guard + `activeRole` autorita (§4). PARENT
nezíská generické oprávnění žádnou cestou (RolePermission, UserPermission,
defaults), guardian přístup je výhradně vztahový přes VERIFIED `/guardian/*`,
legitimní TEACHER override i multi-role přepínání i OWNER/systémové bypassy
zůstávají funkční. Finální merge verdikt je veden v PR a je podmíněn zelenou
plnou regresí a zelenými required CI checks; bez merge dle zadání.
