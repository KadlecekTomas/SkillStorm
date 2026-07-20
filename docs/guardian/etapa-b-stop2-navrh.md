# Guardian Etapa B — STOP #2: návrh datového modelu

Stav: **SCHVÁLENO s úpravami (20. 7. 2026)** — úpravy zapracovány níže · Branch: `feature/guardian-space` · Pokrývá body 1, 3, 4, 8, 9, 11, 15 specifikace (`docs/guardian-spec.md`); STOP #2 fixuje datový model — UI a API se implementují až po schválení.

Navazuje na Etapu A (v mainu, PR #21): multi-role přes `MembershipRoleAssignment`, STUDENT exkluzivní, PARENT je ne-eskalující role, kterou si uživatel smí přidat k vlastnímu členství (`membership-roles.service.ts`), `switch-role` + `lastActiveRole` fungují.

---

## 1. Rozhodnutí, která návrh fixuje

1. **Guardian strana vztahu = `Membership`** (s rolí PARENT), ne `User`. Rodič ve dvou školách má dvě členství a dvě sady vztahů — tenant izolace je pak stejná disciplína jako všude jinde v repu. Rodič bez jiného vztahu ke škole dostane membership s jedinou rolí PARENT.
2. **Dětská strana vztahu = `Student` profil**, ne User ani Membership. `Student` je org-scoped žákovský profil (spec: „žákovský profil"), má composite unique `(student_id, organization_id)` — org konzistenci vztahu vynutí composite FK na DB úrovni (vzor `enrollments_student_org_fk`).
3. **Oprávnění per dítě jako Postgres enum pole na řádku vztahu** (`GuardianPermissionKey[]`), ne join tabulka a ne globální role. Vyhodnocuje se vždy vůči konkrétnímu vztahu; změny loguje audit (Etapa D). Basic/detail zobrazení je oddělená *prezentační* preference a s oprávněními se nikdy nemíchá.
4. **Párování zakládá výhradně škola** rozšířením stávající `Invite` infrastruktury (token + 6znakový kód + brute-force ochrana už existují). Žádné samoobslužné „najdi si dítě".
5. **Revokace platí okamžitě** — guard čte stav vztahu z DB při každém požadavku (vzor okamžité revokace rolí z Etapy A). Nic o vztazích se necachuje do JWT.

## 2. Datový model

### 2.1 `GuardianStudentRelation` (`guardian_student_relations`)

| Sloupec | Typ | Pozn. |
|---|---|---|
| `id` | uuid PK | |
| `guardianMembershipId` | FK → `memberships` | + composite FK `(guardian_membership_id, organization_id)` → `memberships(membership_id, organization_id)`¹ |
| `studentId` | FK → `students` | + composite FK `(student_id, organization_id)` → `students(student_id, organization_id)` |
| `organizationId` | FK → `organizations` | denormalizace pro tenant guard + composite FKs |
| `type` | enum `GuardianRelationType` | `PARENT \| LEGAL_GUARDIAN \| OTHER` |
| `status` | enum `GuardianRelationStatus` | `PENDING \| VERIFIED \| DISPUTED \| REVOKED` |
| `permissions` | `GuardianPermissionKey[]` | default viz 2.2 |
| `verifiedAt` / `verifiedById` | timestamp / FK → `memberships` | kdo za školu ověřil (nebo vystavil pozvánku) |
| `revokedAt` / `revokedById` | timestamp / FK → `memberships` | REVOKED je konečný stav; nový přístup = nový řádek |
| `validUntil` | timestamp? | časově omezený přístup (spec bod 8); guard: `validUntil < now()` ⇒ jako REVOKED |
| `notificationPrefs` | Json? | jen připravený sloupec pro notifikační projekt (kolizní bod 5); UI žádné |
| `createdAt` / `updatedAt` | | |

¹ vyžaduje novou composite unique `(membership_id, organization_id)` na `memberships` — aditivní, unikátnost plyne z PK.

Indexy: `(organizationId)`, `(studentId)`, `(guardianMembershipId)`; **partial unique** `(guardianMembershipId, studentId) WHERE status <> 'REVOKED'` — jeden živý vztah na pár, historie revokovaných řádků zůstává pro audit.

Řádky se **nikdy nemažou** (soft-delete přes REVOKED) — auditní stopa je doménová, audit log ji v Etapě D doplňuje, nenahrazuje.

### 2.2 `GuardianPermissionKey`

`VIEW_RESULTS, VIEW_ASSIGNMENTS, START_PRACTICE, START_HOMEWORK, START_TEST, RECEIVE_NOTIFICATIONS, MANAGE_STUDENT_ACCESS, RESET_STUDENT_PIN`

Default při ověření: `VIEW_RESULTS, VIEW_ASSIGNMENTS, START_PRACTICE, START_HOMEWORK, RECEIVE_NOTIFICATIONS`. `START_TEST` default NE (princip 4 — konzervativní u klasifikovaných testů; učitel/škola povolí explicitně). **Rozhodnutí STOP #2:** žádné rezervní klíče — budoucí oprávnění (nákup obsahu, export, komunikace s učitelem) žijí jen v docs a do enumu se přidají až s implementací své vertikály.

### 2.3 Žákovský účet bez e-mailu

`User.email` už je nullable a `username` unique — základ existuje. Doplnění na `Student` (org-scoped, škola spravuje per-org):

- `pinHash` (varchar, argon2/bcrypt přes stávající `hashPassword`; nikdy plaintext),
- `pinUpdatedAt`, `pinFailedCount`, `pinLockedUntil` — limit pokusů (vynucení v Etapě C/D, sloupce teď, ať nemigrujeme dvakrát).

PIN v Etapě B slouží jen správě (škola/oprávněný rodič ho nastaví/resetuje). Jako *login* mechanismus a ověření dítěte v relaci ho použije až Etapa C. QR / školní přihlašovací kód = zakódování `username` + jednorázového kódu, návrh patří k relacím (Etapa C) — tady jen šev. SSO = existující `UserIdentity` (PR #3), šev beze změn.

### 2.4 `InterfacePreference`

`User.interfaceDetailLevel` enum `InterfaceDetailLevel = BASIC | DETAILED`, default `BASIC` (spec bod 4: default pro všechny, žádné „senior" labely). Na Useru, ne membershipu — je to prezentační preference člověka, ne role.

## 3. Párování řízené školou

Rozšíření `Invite`: `InvitationType` + `GUARDIAN`, nový nullable sloupec `targetStudentId` (FK → students; povinný pro GUARDIAN typ na aplikační úrovni).

**Primární flow (rozhodnutí STOP #2): bulk pro celou třídu.** Třídní/ředitel vygeneruje párovací kódy pro všechny žáky třídy najednou + tisknutelný arch lístečků (jméno žáka + kód + krátká instrukce k registraci); po-jednom vystavená pozvánka je sekundární cesta. Kód: **jednorázový (`maxUses=1`), expirace 30 dní**, krátký formát zadatelný z papírku — existující 6znaková abeceda bez ambiguitních znaků (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).

Flow: vygenerování kódu založí `GuardianStudentRelation` **PENDING** s `verifiedById` = vystavitel → rodič se registruje/přihlásí a zadá kód (accept: založí/rozšíří membership o PARENT roli existující `membership-roles` cestou) → **potvrzovací obrazovka při prvním přihlášení** („Je Matěj Novák, 5.A, vaše dítě?"): „Ano" → **VERIFIED**; „Ne, to není moje dítě" → **DISPUTED** — stav viditelný škole (třídní ho vidí u žáka a v přehledu párování; vyřeší revokací a novým kódem). DISPUTED vztah nedává rodiči žádný přístup k dítěti. Onboarding: potvrzení dítěte → upozornění → přehled, nic víc.

Více rodičů = více pozvánek na téhož žáka. Učitel-rodič v téže org: pozvánka přidá PARENT roli k existujícímu membershipu, kontext se přepíná přes `switch-role` z Etapy A — žádné druhé přihlášení.

## 4. Vynucování na serveru

Nový `GuardianAccessGuard` + dekorátor `@RequireGuardianPermission(key)` pro `/guardian/*` endpointy: z aktivní role PARENT + `:studentId` v parametru načte vztah a vyhodnotí `status = VERIFIED ∧ (validUntil ∅ ∨ > now) ∧ key ∈ permissions`. Cizí tenant → **404**, existující vztah bez oprávnění / cizí dítě v téže org → **403**. `studentId` z klienta se nikdy nepřijímá bez tohoto ověření (princip 3).

Náčrt API (implementace po STOPu): `GET /guardian/children` · `POST /guardian/relations/accept` · `GET /guardian/children/:studentId/overview` (4 bloky rodinného prostoru) · škola: `POST /students/:id/guardian-invites`, `POST /guardian/relations/:id/revoke`, `GET /students/:id/guardians`. Serializace guardian odpovědí **nikdy** nenese XP/level/parťáka (princip 5) — kryto testem.

## 5. Migrace

Čistě aditivní: 3 enumy, 1 tabulka, sloupce na `students`, `users`, `invites`, composite unique na `memberships`. Žádný zásah do existujících dat, žádný backfill. Jedna migrace s aktuálním timestampem.

## 6. Testovací matice Etapy B (DoD)

1. Škola vystaví pozvánku → rodič potvrdí kódem → vidí dítě (happy path, nový i existující uživatel).
2. Cizí dítě v téže org → 403; cizí tenant → 404 (i pro school-side endpointy).
3. REVOKED / `validUntil` v minulosti → okamžitě 403 bez re-loginu.
4. Guardian odpovědi neobsahují XP/level/parťáka (rekurzivní assert klíčů, vzor `tests-answer-key-regression`).
5. Multi-parent: dva rodiče téhož dítěte nezávisle; revokace jednoho nesmí zasáhnout druhého.
6. Učitel-rodič: jeden membership, obě role, přepnutí kontextu mění viditelná data.
7. DB invariant: cross-org vztah neprojde ani přímým SQL (composite FK), duplicitní živý vztah neprojde (partial unique).
8. Basic/detail: změna preference nemění žádnou API autorizaci (403/404 mapa identická).

## 7. Rozhodnutí STOP #2

Rozhodnuto 20. 7. 2026:
1. Defaults oprávnění dle návrhu (`START_HOMEWORK` ano, `START_TEST` ne). ✅
2. PENDING → potvrzení rodičem → VERIFIED, jako jedna obrazovka při prvním přihlášení; „Ne, to není moje dítě" → **DISPUTED**, viditelné škole. ✅
3. PIN 4–6 číslic; hash + počítadla pokusů; PIN se nikdy nesmí objevit v lozích. ✅
4. Rezervní klíče z enumu vyhozeny — budoucí oprávnění jen v docs. ✅
5. Rozsah Kroku 2 doplněn: bulk generace kódů pro třídu + tisknutelný arch (primární flow); kód jednorázový, expirace 30 dní, bez ambiguitních znaků. ✅
