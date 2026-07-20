# Guardian Etapa A — Multi-role Membership: analýza a návrh (STOP #1)

> Branch: `refactor/multi-role-membership` · Stav: **návrh ke schválení, žádná implementace**
> Pokrývá bod 10 specifikace (docs/guardian-spec.md) a Krok 1 Etapy A (docs/guardian-project.md).
> Základna: main `f459869` (zelený, branch protection aktivní).

---

## 1. Executive summary

Systém dnes všude předpokládá **jednu roli na membership**: `Membership.role` je skalární enum,
`@@unique([userId, organizationId])` povoluje jediný membership na uživatele v organizaci, JWT a
OrgContext nesou jedinou `organizationRole`, a vznik satelitních řádků `Teacher`/`Student` větví na
této jediné hodnotě.

**Návrh:** aditivní tabulka `MembershipRoleAssignment` (membership × role, s auditem), zachování
`Membership.role` jako **primární role** (100% zpětná kompatibilita), autorizace vázaná na
**aktivní roli** v JWT (ne union), přepínání kontextu rozšířením existujícího org-switch švu,
a v první verzi pravidlo **STUDENT je exkluzivní** (nekombinuje se), čímž se vyhneme míchání
XP/parťáka a identity odevzdání.

---

## 2. Úplná mapa závislostí na `Membership.role`

Celkové počty (grep): server/src `OrganizationRole` 290 řádků, `organizationRole` (JWT/ctx pole)
76 řádků, přímá porovnání `.role ===/!==` 50 výskytů, `hasAtLeastRole` ~30 call-sites,
`role: { in: [...] }` 8 dotazů; klient ~49 role-podmínek v 16 souborech; testy: 80 e2e spec
souborů, `authAs(role)` 48×.

### 2.1 Schéma (server/prisma/schema.prisma)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `schema.prisma:175` | `Membership.role OrganizationRole` — skalár | jádro změny |
| `schema.prisma:200` | `@@unique([userId, organizationId])` | 1 membership/org; **zachovat** (viz §3.2) |
| `schema.prisma:201` | `@@index([organizationId, role])` | per-role dotazy (statistiky) čtou primární roli |
| `schema.prisma:176-178` | `xp`, `level`, `avatarType` na Membership | parťák sdílí řádek s rolí → důvod STUDENT exkluzivity |
| `schema.prisma:986` | `Submission.studentId` → **Membership.id** | identita žáka ve výsledcích = membership |
| `schema.prisma:593,633` | `Teacher.membershipId @unique`, `Student.membershipId @unique` | satelit 1:1; multi-role = satelit per přiřazená role |
| `schema.prisma:23,43` | `User.lastActiveMembershipId` | šev pro „poslední kontext“; rozšíří se o roli |
| `schema.prisma:1458-1464` | enum `OrganizationRole` (STUDENT, TEACHER, DIRECTOR, OWNER, PARENT) | beze změny |

### 2.2 RBAC vrstva (server)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `server/src/modules/rbac/rbac.guard.ts:46` | OWNER bypass z `user.organizationRole` | čte aktivní roli — beze změny chování |
| `rbac.guard.ts:92-101` | DIRECTOR přes `hasAtLeastRole`, jinak přesná shoda role | vyhodnocuje se vůči aktivní roli |
| `rbac.guard.ts:104` | fallback `rbac.canUser(userId, orgId, key)` | **musí dostat aktivní roli** (viz níže) |
| `server/src/modules/rbac/rbac.service.ts:75-83` | `membership.findFirst` → `role` (bez orderBy!) | latentní nedeterminismus; návrh ho odstraňuje — role se předá explicitně |
| `rbac.service.ts:90-116` | OWNER bypass, `RolePermission` (org→global) pro `membership.role`, fallback defaults | vyhodnocení pro aktivní roli; single-role identické |
| `server/src/modules/rbac/rbac.defaults.ts:34-45` | `RBAC_DEFAULT_PERMISSIONS` role→sada (PARENT: VIEW_RESULTS, VIEW_SUBMISSIONS) | beze změny (mapa zůstává per role) |
| `server/src/modules/rbac/rbac-default-sync.service.ts:24-59` | seed `RolePermission` per role | beze změny |
| `server/src/modules/rbac/rbac-policy.service.ts:30-119` | grant/revoke `RolePermission` per (role, org) + audit | beze změny |
| `server/src/shared/access.utils.ts:7-29` | `ROLE_ORDER` (STUDENT=1, PARENT=1, TEACHER=2, DIRECTOR=3, OWNER=4) + `hasAtLeastRole` | porovnává aktivní roli; beze změny signatury |
| `access.utils.ts:51-66` + ~30 call-sites (tests.service:619,1395; class-sections:532,811,1016,1178,1455; teachers:134,326,380,437,540; enrollments:583; student:549; promotion:111; users:333; learning-materials:127,403,486,539) | `hasAtLeastRole(user.organizationRole, …)` | všechna čtou JWT skalár → fungují nad aktivní rolí beze změny |
| `server/src/auth/guards/roles.guard.ts:34-42` | `requirements.organization.includes(user.organizationRole)` | aktivní role; beze změny |
| `server/src/auth/guards/school-access.guard.ts:24-31` | jen existence membershipu | beze změny |
| `academic-years.controller.ts:99`, `submissions.controller.ts:49,56,68,80` | jediné endpointy s org-role tokenem v `@Permission` (DIRECTOR/OWNER; STUDENT-only) | scoped na aktivní roli — správně (viz §3.3) |

### 2.3 Login / JWT / session (server)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `server/src/auth/types/jwt-payload.ts:3-11` | claims: `organizationRole?`, `organizationId?`, `membershipId?` | + volitelný claim `activeRole` (viz §3.3); název `organizationRole` zůstává |
| `server/src/auth/jwt.strategy.ts:103-124` | per-request: načte membership dle `membershipId`, `organizationRole = membership.role` | nově `organizationRole = activeRole z claims ∈ assignments`, fallback `membership.role` (staré tokeny) |
| `server/src/auth/auth.service.ts:182-196` | `buildClaims`: `organizationRole: membership?.role` | + `activeRole` |
| `auth.service.ts:239-306` | refresh: membership dle `lastActiveMembershipId`/nejstarší → role do claims | + zachovat aktivní roli session (lastActiveRole) |
| `auth.service.ts:841-886` | `resolveSessionMembership` (org výběr: explicit → lastActive → nejstarší) | + resoluce aktivní role (explicit → lastActiveRole → primární) |
| `auth.service.ts:941-1032,894-939` | login/SSO: `organizationRole: membership?.role` | primární role jako default kontext |
| `auth.service.ts:1199-1403` | `getMeContext`: **`roles = [activeMembership.role]`** (1-prvkové pole!) | vrací všechny přiřazené role + `activeRole` — FE store už pole čeká |
| `auth.service.ts:1409-1523` | `useOrganization`/`switchOrganization` + audit USE_ORG/SWITCH_ORGANIZATION | **šev pro přepínání role-kontextu** (rozšíření, viz §3.4) |
| `auth.service.ts:311-329` | `issueTokensForMembership` (invite accept) | + aktivní role = role z invitu |

### 2.4 OrgContext (server)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `server/src/common/org-context/org-context.types.ts:3-10` | `OrgContext.role: OrganizationRole` (skalár) | = aktivní role; ~19 čtenářů `ctx.role` beze změny |
| `org-context.service.ts:29-48` | `role: membership.role` | nově z aktivní role (JWT), fallback primární |
| `org-context.service.ts:50-78` | fallback `findFirst` membership | beze změny (unique zůstává) |
| `org-context.service.ts:122-128` | `hasTeacherLevelRole(ctx)` | aktivní role; beze změny |

### 2.5 Audit (server)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `server/src/audit/audit-data-scope.service.ts:42-74` | viditelnost auditu dle `user.organizationRole` (DIRECTOR/OWNER) | aktivní role — ředitel-rodič vidí audit jen v ředitelském kontextu (žádoucí) |
| `memberships.service.ts:238-239` | `MEMBERSHIP_ROLE_CHANGE` (previousRole/nextRole) | doplní se `MEMBERSHIP_ROLE_ASSIGN/REVOKE` |
| `invites.service.ts:535` | `INVITE_ACCEPTED` metadata role | beze změny |
| `auth.service.ts` USE_ORG/SWITCH_ORGANIZATION | audit přepnutí org | + audit přepnutí role (`SWITCH_ROLE_CONTEXT`) |
| `student/guards/student-access.guard.ts:93,164` | denied reasons per role | aktivní role |

### 2.6 Registrace / invites / vznik satelitů (server)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `server/src/invites/invites.service.ts:263-279,215-237` | invite nese 1 roli; ORG_ONLY ∈ {TEACHER, DIRECTOR, STUDENT} | invite dál nese 1 roli; nově „add-role“ větev při existujícím membershipu |
| `invites.service.ts:408-571` | accept → `createMembershipFromInvite(role)` | + větev: membership existuje → přidat assignment |
| `server/src/auth/auth.service.ts:440-614` | `membership.create({role})`; **:497-511 TEACHER→Teacher řádek, :513-527 STUDENT→Student řádek**, :529-602 STUDENT_CLASS + enrollment; PARENT netvoří nic | tvorba satelitů per přiřazená role (idempotentní helper) |
| `auth.service.ts:146-155` | `resolveJoinRole` povoluje PARENT — **mrtvý kód (nikde nevolán)** | smazat nebo oživit v Etapě B |
| `organizations.service.ts:376-380` | zakladatel → OWNER membership | + assignment řádek |
| `imports.service.ts:213-232` | CSV import → STUDENT membership + satelit + enrollment | + assignment řádek |
| `memberships.service.ts:34-38` | legacy create = GoneException | beze změny |
| `memberships.service.ts:217-219` | update role = přepis skaláru | nově řízená operace nad assignments (primární vs. sada) |
| `memberships.service.ts:253-331` | soft-delete membership kaskádně maže Teacher i Student | + kaskáda na assignments |
| `teachers.service.ts:109-173` | `create()` vyžaduje `membership.role === TEACHER` (:119) | nově „TEACHER ∈ assignments“ |

### 2.7 Doménové větvení podle role (server, mimo RBAC)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `platform-health.service.ts:719,878` (+754,895) | `groupBy(['organizationId','role'])` → počty žáků/učitelů | čte primární roli — počty stávajících uživatelů beze změny; multi-role user počítán 1× pod primární rolí (dokumentovaná limitace v1) |
| `stats.service.ts:150-166,797,816` | dashboard scope dle role | aktivní role (správně: „za koho se dívám“) |
| `analytics.service.ts:163-184` | STUDENT→self, staff→cizí; `findFirst({role: STUDENT})` | aktivní role + lookup přes assignments |
| `tests.service.ts:1564-1781` (6 míst) | viditelnost testů STUDENT vs TEACHER | aktivní role |
| `class-sections.service.ts` (8 míst), `submissions.service.ts` (11 míst, `String(membership.role)`), `learning-materials.service.ts:365`, `campaigns.service.ts:486`, `organizations.service.ts:168`, `teacher-access.service.ts:121`, `memberships.service.ts:63`, `teachers.service.ts:208` | scoping/gaty dle role | aktivní role; submissions při STUDENT exkluzivitě bez rizika smíchání identit |
| `gamification.service.ts:14,67` | `XP_ALLOWED_ROLES` (PARENT vyloučen) | beze změny; STUDENT exkluzivita chrání XP |
| `access.utils.ts:132-163` | `teacherClassScope` — stojí na `Teacher.id`, ne na roli | **multi-role odolné beze změny** |

### 2.8 Seedy (server/prisma/seed)

`membership.create/upsert` 11×: `users.seed.ts:147` (+ mapa :40-58 s flagy asTeacher/asStudent),
`full-production-seed.ts:276,303,776`, `full-walkthrough-seed.ts:391`, `demo-flow-seed.ts:146`,
`promotion-stress.seed.ts:118,169`, `cross-org.seed.ts:51`, `scenarios-e2e.seed.ts:124`,
`showcase.seed.ts:307`; `rbac.seed.ts:11-68` iteruje enum (vč. PARENT).
Vše stojí na upsertu přes `userId_organizationId` — **unique zůstává, seedy se nemění**; jen
sdílený helper vzniku membershipu doplní assignment řádek.

### 2.9 Testy (server/test)

`test/helpers.ts`: `authAs` (:79, :154 `membership.update({role})`), `useOrg` (:310),
`normalizeRole` (:342, OWNER→DIRECTOR), `addMembershipForUser` (:390 upsert role, netvoří
satelity); `test/e2e/helpers/bootstrap-org.ts`. 80 e2e specs; matice:
`tenant-scope-fortress`, `rbac-owner-invariant`, `owner-parity`, `multi-org-security`,
`auth.policy` (:369 PARENT kontrakt), `assignments` (:582 PARENT 403 negativní).
Dopad: helpery přepnou na „set role = {X}“ (přepis primární + sync assignmentů) — chování
stávajících testů identické.

### 2.10 Klient (client/src)

| Místo | Užití | Dopad multi-role |
|---|---|---|
| `store/use-auth-store.ts:44,75-86,100-124,180-188` | drží **`roles[]`** (union přes memberships), persistuje | zdroj se zpřesní: `availableRoles` aktivního membershipu + `activeRole` |
| `utils/permissions.ts:43-55` | `derivePermissions` — **jen singulár `user.organizationRole`** | zůstává singulár = aktivní role (konzistentní se serverem) |
| `hooks/use-permissions.ts:24-32` | `hasRole` — singulár | aktivní role |
| `lib/guard/useGuard.ts:36,78-80` | `requireRoles.some(r => roles.includes(r))` — **jediné union místo** | sjednotit na aktivní roli (viz §3.5) |
| `lib/guard/useAuth.ts:150-230,330-440` | syncProfile, `switchOrganization(membershipId)`, `use-org` | + `switchRole(role)`; localStorage `skillstorm_activeMembershipId` + nově aktivní role |
| `components/layout/dashboard-layout.tsx:24-54` a `dashboard-header.tsx:43-98` | `.find(m => m.organizationId === org.id)` — kolize při 2 membershipech/org | unique zůstává → **kolize nevznikne** (důvod proti variantě „2 memberships“) |
| `types/permissions.ts:3` + `ROLE_PERMISSION_MATRIX` + `roleHome` | typy, matice, landing per role (PARENT → /app/results) | + `activeRole`/`availableRoles` v typech; roleHome dle aktivní role |
| `types/index.ts:190,205` | `MembershipSummary.role`, `User.organizationRole` | `MembershipSummary.roles: OrganizationRole[]` + `role` (primární) zůstává |
| `config/dashboard-navigation.tsx:21-27`, `sidebar.tsx:107-142` | nav statická, role jen badge | přepínač kontextu v headeru; parent nav až Etapa B |
| `hooks/use-role-view.ts:10-24`, `getDashboardTitle` | singulár | aktivní role |
| `config/live-age-mode.ts`, `config/answering-mode.ts` | věkové režimy **z ročníku, ne z role** | beze změny (v souladu s kolizním bodem 2 guardian-project) |
| PARENT dnes | jen enum + matice + roleHome; **žádné UI, žádná stránka** | plocha vznikne v Etapě B |
| `client/tests/scenarios/fixtures.ts:25-47`, `mocks/state.ts:38,304,311` | role fixtures, mock `roles[]` délky 1 | + fixture učitel-rodič v Etapě B |

---

## 3. Návrh

### 3.1 Model: `MembershipRoleAssignment` (zvolená varianta)

```prisma
model MembershipRoleAssignment {
  id           String           @id @default(uuid()) @map("membership_role_assignment_id")
  membershipId String           @map("membership_id")
  role         OrganizationRole
  createdAt    DateTime         @default(now()) @map("created_at")
  createdById  String?          @map("created_by_membership_id") // kdo roli přiřadil (audit; null = migrace/systém)
  deletedAt    DateTime?        @map("deleted_at")
  membership   Membership       @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  @@unique([membershipId, role])
  @@index([role])
  @@map("membership_role_assignments")
}
```

`Membership` beze změny struktury; `Membership.role` dostává sémantiku **primární role**
(= default kontext po loginu, = hodnota pro per-role statistiky). Volitelně
`Membership.lastActiveRole OrganizationRole?` pro zapamatování posledního kontextu.

**Invarianty:**
1. primární role ∈ aktivní assignments (vynucené v service vrstvě + e2e),
2. **STUDENT je v v1 exkluzivní** — membership se STUDENT nemá žádnou další roli
   (validace při přiřazení). Důvod: `Submission.studentId = Membership.id` a XP/parťák na
   membershipu; kombinace STUDENT+X by míchala identitu odevzdání a bezpečný prostor dítěte.
   Guardian potřebuje TEACHER+PARENT, DIRECTOR+PARENT, OWNER+PARENT — vše povoleno.
3. Teacher řádek existuje ⇔ TEACHER ∈ assignments; Student ⇔ STUDENT; PARENT satelit nemá
   (vazba na děti = GuardianStudentRelation v Etapě B, ukotvená na membershipId rodiče).

**Zamítnuté alternativy:**
- `roles OrganizationRole[]` (enum array na Membership): bez auditu (kdo/kdy přiřadil), bez
  soft-delete jednotlivé role, slabší dotazy/constrainty. Spec bod 8/16 audit vyžaduje.
- **Více membershipů na (user, org)** (zrušení unique): rozbíjí 11 seed upsertů přes
  `userId_organizationId`, desítky `findFirst({userId, organizationId})`, klientské
  `.find(m => m.organizationId === org.id)` (dashboard-layout:26, dashboard-header:46),
  a hlavně **rozdvojuje XP/parťáka a identitu** jednoho člověka v jedné škole. Největší
  blast radius, nejmenší přínos.

### 3.2 Migrace (aditivní, vratná)

Migrace `add_membership_role_assignments`:
1. `CREATE TABLE membership_role_assignments` + unique `(membership_id, role)` + index `(role)`.
2. Backfill z existujících řádků: každý Membership dostane právě jeden assignment své role —
   `INSERT INTO membership_role_assignments (membership_role_assignment_id, membership_id, role, created_at)
   SELECT gen_random_uuid(), membership_id, role, now() FROM memberships;`
   (včetně soft-deleted membershipů — o viditelnosti rozhoduje `memberships.deleted_at`).
3. Volitelně `ALTER TABLE memberships ADD COLUMN last_active_role` (nullable).

**Co se stane s existujícími řádky Membership: nic se nemění ani nemaže.** `role` zůstává
NOT NULL se stávající hodnotou (nyní „primární role“). Rollback = drop nové tabulky/sloupce.
Žádné ruční zásahy do produkčních dat, žádné přepisy rolí.

### 3.3 Autorizace: aktivní role, ne union

JWT dostane nový volitelný claim `activeRole`; **claim `organizationRole` zůstává** (76 čtenářů
beze změny) a je vždy = aktivní roli. `jwt.strategy.validate` nově: ověří
`activeRole ∈ assignments(membershipId)` (DB, jako dnes ověřuje membership), jinak fallback
`membership.role`. Starý token bez claimu → primární role → **chování identické s dneškem**.

Oprávnění se vyhodnocují **výhradně vůči aktivní roli** (RbacGuard beze změny logiky;
`rbac.service.canUser` dostane aktivní roli explicitně místo nedeterministického `findFirst` —
oprava latentního bugu). Union se nikde nezavádí. Důvody:
- guardian princip „server je jediný soudce“ + provenance: každá akce má jasné „za koho jednám“;
- audit: ředitel-rodič nevidí ředitelský audit z rodičovského kontextu;
- konzervativní default (princip 4): učitelská práva se nepřelévají do rodičovského UI;
- pro všechny stávající (single-role) uživatele je aktivní role = jejich jediná role → nulová
  změna chování, což je přesně požadavek zpětné kompatibility.

### 3.4 Přepínání kontextu (kolizní bod 1: učitel-rodič v téže org)

Jedno přihlášení, jeden membership, jedna session — **přepíná se pouze aktivní role**, rozšířením
existujícího švu `useOrganization`/`switchOrganization` (auth.service:1409-1523):

- `POST /auth/switch-role { role }` (tenant-scoped): ověří `role ∈ assignments` aktivního
  membershipu, vydá nový access token s `activeRole`, zapíše `lastActiveRole`, audit
  `SWITCH_ROLE_CONTEXT`. Cizí/nepřiřazená role → 403. Refresh flow obnovuje poslední aktivní
  roli (stejný vzor jako `lastActiveMembershipId`).
- Klient: přepínač v headeru vedle org-switcheru (dashboard-header) — memberships s
  `roles.length > 1` nabídnou „Přepnout na: Rodič / Učitel“; `switchRole(role)` v useAuth
  (vzor `switchOrganization`), po přepnutí `syncProfile({force: true})` + redirect na
  `roleHome[activeRole]` (učitel → /app/tests, rodič → rodinný prostor v Etapě B).
- `/auth/me` vrací `memberships[].roles`, `activeRole`; store drží `activeRole` +
  `availableRoles`; `derivePermissions`/`hasRole`/`useRoleView` zůstávají singulárové nad
  aktivní rolí.
- Rodičovský kontext = plnohodnotný kontext, ne „módní přepínač“: navigace, landing i data
  se řídí aktivní rolí; parťák v učitelském ani rodičovském kontextu není (princip 3+18).
  Vizuální odlišení rodičovského režimu řeší Etapa B.
- Věkové režimy (young/old) se odvozují z ročníku, ne z role — kolizní bod 2 tím zůstává
  nedotčen.

### 3.5 Klientská sjednocení (Krok 2)

- `useGuard.ts:78` — dnes jediné union místo (`roles.includes`); sjednotit na aktivní roli,
  jinak by route guard pustil učitele-rodiče na rodičovské route bez přepnutí kontextu
  (nekonzistence se serverem, který vrátí 403).
- `MembershipSummary.roles: OrganizationRole[]` do typů; `deriveRoles` číst z aktivního
  membershipu (dnes union napříč všemi orgy — latentní nepřesnost).
- Select-organization / dashboard-header: položka per membership zůstává (unique platí),
  role v závorce nahradí seznam rolí.

### 3.6 API změny (Krok 2, shrnutí)

| Endpoint | Změna |
|---|---|
| `POST /auth/switch-role` | nový (viz §3.4) |
| `GET /auth/me` | `memberships[].roles`, `activeRole` (aditivní pole) |
| `POST /memberships/:id/roles` + `DELETE /memberships/:id/roles/:role` | správa assignmentů (DIRECTOR+; audit `MEMBERSHIP_ROLE_ASSIGN/REVOKE`; validace STUDENT exkluzivity; idempotentní satelity) |
| invite accept (`invites.service` + `createMembershipFromInvite`) | existující membership + nová role → přidá assignment (+satelit), nezakládá druhý membership; stejná role → idempotentní hláška |
| vše ostatní | beze změny kontraktu |

### 3.7 Testovací strategie (Krok 2)

1. **Regrese:** kompletní stávající běh (~410 server e2e, 25 PW scénářů, unit/policy/RBAC) —
   nulová změna chování single-role uživatelů; staré tokeny bez `activeRole` claimu.
2. **Nové e2e:** assignment CRUD + audit; switch-role (vlastní/nepřiřazená/cizí org role);
   permission scoping per aktivní role (učitel-rodič: teacher endpoint v parent kontextu → 403);
   STUDENT exkluzivita; invite-accept nad existujícím membershipem; refresh zachovává aktivní
   roli; primární-role invariant; tenant matice rozšířená o multi-role aktéra.
3. **Klient:** unit derivePermissions/hasRole nad activeRole; scénář přepnutí kontextu
   (fixture učitel-rodič — plný průchod až v Etapě B s rodičovským UI).

---

## 4. Rozhodnutí STOP #1 (schváleno zadavatelem 2026-07-20)

1. **STUDENT exkluzivita v1 — ANO.** Membership s rolí STUDENT nemá žádnou další roli.
2. **`lastActiveRole` na Membership — ANO.**
3. **`resolveJoinRole` (auth.service:146) — smazat v Kroku 2.**
4. **Per-role statistiky = dokumentovaná limitace v1:** `platform-health.service` groupuje podle
   `Membership.role` (primární role) — učitel-rodič se v platform statistikách počítá jako
   učitel. Revize až podle potřeby v pozdější etapě.

### 4.1 Vynucení invariantu „primární role ∈ aktivních assignments“ (doplnění A)

Tři vrstvy, od nejměkčí po nejtvrdší:

1. **Jediná servisní cesta zápisu:** `MembershipRolesService`
   (`server/src/memberships/membership-roles.service.ts`) je jediné místo, které zapisuje do
   `membership_role_assignments` A ZÁROVEŇ mění `Membership.role`/`lastActiveRole`. Všechny
   operace (přiřazení role, odebrání role, změna primární role, vznik membershipu s rolí) běží
   v jedné transakci, která vždy udrží: primární role má aktivní assignment; STUDENT
   exkluzivita; satelit (Teacher/Student) existuje pro přiřazenou roli. Přímé
   `prisma.membershipRoleAssignment.*` mimo tuto službu jsou zakázané (hlídá code review +
   grep check v testech políčka).
2. **DB-level vynucení — deferred constraint trigger:** migrace přidává funkci
   `enforce_membership_primary_role()` a `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`
   na `memberships` (INSERT/UPDATE role, deleted_at) i `membership_role_assignments`
   (INSERT/UPDATE/DELETE): při COMMITu ověří, že každý nesmazaný membership má nesmazaný
   assignment své `role` a že STUDENT membership nemá žádný další aktivní assignment.
   DEFERRED je nutné, protože servisní transakce vytváří membership a assignment ve dvou
   krocích téže transakce. Vzor: repo už DB triggery používá (SUBMISSION_LOCKED).
3. **e2e konzistenční test:** (a) po plném seedu raw SQL kontrola, že žádný membership
   neporušuje invariant; (b) pokus o porušení raw SQL (INSERT membership bez assignmentu,
   DELETE assignment primární role, druhý assignment k STUDENT membershipu) → očekává se
   selhání COMMITu na triggeru; (c) servisní pokusy → 4xx.

### 4.2 Revokace assignmentu vs. živé JWT (doplnění B)

Access token má TTL 15 min, ale na TTL se nespoléháme — **revokace je účinná od následujícího
requestu**:

- `jwt.strategy.validate` už dnes na každém requestu čte membership z DB (dle claimu
  `membershipId`). Rozšíření: select natáhne i aktivní assignments
  (`roleAssignments(where: deletedAt: null)`), a efektivní role se určí takto:
  1. token má `activeRole` → musí být v aktivních assignments, jinak **401
     `ROLE_CONTEXT_REVOKED`** (klient zareaguje refresh flow/re-login; refresh vydá token
     s aktuální primární rolí);
  2. token bez `activeRole` (starý token) → `membership.role` (primární) — beze změny chování.
- `OrgContext` se staví z takto ověřené efektivní role — do service vrstvy se revokovaná role
  nikdy nedostane. Guardian dopad: odebrání rodičovské role znamená okamžitou ztrátu
  rodičovského kontextu (a v Etapě B tím i přístupu k dětem), ne za 15 minut.
- Revokace primární role neexistuje jako samostatná operace: primární roli lze jen ZMĚNIT
  (transakčně, viz 4.1), takže membership nikdy nezůstane bez platné primární role.
- Náklady: žádný nový dotaz — rozšíření selectu existujícího per-request čtení; index
  `@@unique([membershipId, role])` pokrývá lookup.

## 5. Stav implementace (Krok 2, 2026-07-20)

Implementováno dle tohoto návrhu s jednou upřesněnou mechanikou: vedle deferred CHECK
triggerů přibyl **sync trigger `membership_primary_role_sync`** (INSERT / skutečná změna
`memberships.role` → replace-sync assignmentů dle single-role sémantiky).

> **Přechodový mechanismus:** sync trigger existuje jen kvůli legacy zápisovým cestám,
> které znají pouze `memberships.role`. Až bude sloupec `role` v budoucnu odstraněn
> (single source of truth = `membership_role_assignments`), odchází trigger s ním —
> žádná další logika na něm nesmí stavět. Díky němu legacy
zápisové cesty (seedy, test helpery, memberships.update, invite create path) nevyžadují
žádné úpravy a invariant drží konstrukčně; multi-role přidávání jde výhradně přes
`membership_role_assignments` (tam sync trigger nefiruje) — `changePrimaryRole` proto po
updatu primární role v téže transakci znovu aktivuje ostatní role. Invite accept se
stejnou rolí zůstal idempotentní (201, původní kontrakt); `switchRoleContext` +
`POST /auth/switch-role`; revokace účinná od následujícího requestu (401
`ROLE_CONTEXT_REVOKED` v jwt.strategy). E2E: `test/e2e/multi-role-membership.e2e-spec.ts`
(7 scénářů vč. raw-SQL útoků na invariant).

## 6. Definition of done Etapy A (z guardian-project.md)

Main zelený · žádná změna chování pro existující uživatele (plná regrese) · dokumentovaný nový
model rolí (tento dokument + docs/guardian.md v Etapě D) · branch protection prošla.
