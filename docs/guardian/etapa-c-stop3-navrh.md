# Guardian Etapa C — STOP #3: relace, provenance a bezpečnostní model

Stav: **SCHVÁLENO s upřesněními (21. 7. 2026)** — zapracováno níže · Branch: `feature/guardian-sessions` · Pokrývá body 2, 5, 6, 7, 12, 13, 18 specifikace. STOP #3 fixuje model relací + provenance + bezpečnost; implementace až po schválení.

Navazuje na Etapu B (PR #26): vztahy `GuardianStudentRelation` s per-dítě oprávněními (`START_PRACTICE`, `START_HOMEWORK`, `START_TEST`), PIN infrastruktura na `students` (hash + počítadla, zatím nevynucovaná), rodinný prostor.

---

## 1. Rozhodnutí, která návrh fixuje

1. **Žákovská relace = výměna identity na úrovni tokenů, ne „impersonace".** „Spustit pro Matěje" vydá **žákovské tokeny dítěte** (jeho membership, role STUDENT) s krátkou platností a claimem `learningSessionId`. Cookies rodiče se PŘEPÍŠOU žákovskými — v prohlížeči pak neexistuje žádná rodičovská identita, kterou by šlo vytáhnout přes back button, změnu URL nebo DevTools (princip oddělených identit; splňuje bod 13 „neobnovitelná přes back, oddělená od rodičovské session"). Návrat = plnohodnotné rodičovské ověření (heslo), ne UI trik.
2. **Server je jediný soudce:** JWT strategy při KAŽDÉM requestu s claimem `learningSessionId` ověří, že relace je ACTIVE a nevypršela (vzor okamžité revokace z Etap A/B). Ukončení/revokace relace zneplatní tokeny okamžitě — žádné čekání na expiraci.
3. **Provenance je aditivní sloupec na odevzdání** (`submissions.learning_session_id`, nullable FK). Answering flow, autosave i `finish()` se NEMĚNÍ (nedotknutelný invariant) — odevzdání dítěte, které se přihlásilo samo, má sloupec NULL a čte se jako „přihlásil se samostatně".
4. **Klasifikovaný test má konzervativní default: rodičovské spuštění VYPNUTO.** Učitel režim volí explicitně při zadání (bod 6); default nikdy nevytváří dojem ověřeného samostatného výkonu (princip 4).
5. **Věkový režim dítěte se řídí dítětem** (jeho ročníkem), `?mode=` override v guardian relaci nefunguje (kolizní bod 2). Parťák dítěte v relaci JE vidět — je to session dítěte; rodič ho ve svém UI nevidí nikdy.

## 2. Datový model

### 2.1 `LearningSession` (`learning_sessions`)

| Sloupec | Typ | Pozn. |
|---|---|---|
| `id` | uuid PK | |
| `studentId` / `organizationId` | FK | composite FK `(student_id, organization_id)` → students (vzor Etapy B) |
| `initiatorMembershipId` | FK → memberships | kdo relaci spustil + composite FK na org |
| `initiatedVia` | enum `SessionInitiation` | v1 jen `GUARDIAN` (žádné rezervy — STOP #2); „samostatně" = NULL provenance na submission, TEACHER až s implementací |
| `verificationMethod` | enum `ChildVerification` | `NONE \| PIN` (v1; PASSWORD/SSO/CODE až s režimy, které je použijí) |
| `assistanceDeclared` | boolean | „pomáhal jsem" — deklarace rodiče při spuštění |
| `assignmentId` | FK, **povinné** | v1 je relace vždy vázaná na konkrétní zadání (rozhodnutí STOP #3 č. 3); „typ" aktivity nese `GuardianLaunchPolicy` zadání |
| `guardianRelationId` | FK → guardian_student_relations | přes který vztah byla spuštěna (provenance + audit) |
| `startedAt` / `expiresAt` / `endedAt` | timestamps | default TTL **60 min**, konfigurovatelné konstantou |
| `status` | enum `LearningSessionStatus` | `ACTIVE \| ENDED \| EXPIRED \| REVOKED` |

Indexy: `(studentId, status)`, `(organizationId)`, partial unique **jedna ACTIVE relace na dítě** (`WHERE status='ACTIVE'`) — sourozenci na jednom zařízení se nikdy nepromíchají, druhé spuštění nejdřív ukončí první.

### 2.2 Provenance na odevzdání

`submissions.learning_session_id` (nullable FK, `ON DELETE SET NULL` NE — `RESTRICT`; relace se nemažou). Sémantika čtení pro učitele:

| Stav | Učitel vidí |
|---|---|
| NULL | „Matěj se přihlásil samostatně." |
| session GUARDIAN + NONE | „Test spustil rodič, Matěj nebyl dodatečně ověřen." |
| session GUARDIAN + PIN | „Test spustil rodič, Matěj potvrdil PINem." |
| + `assistanceDeclared` | „Rodič uvedl, že s úkolem pomáhal." |

Server vrací strukturovaná data (`initiatedVia`, `verificationMethod`, `assistanceDeclared`), lidské věty skládá klient — ale API má i `provenanceLabel` v češtině pro učitelský detail, ať je jazyk jednotný (bod 14: žádné enum dumpy).

### 2.3 Pravidlo spuštění na zadání

`assignments.guardian_launch_policy` enum `GuardianLaunchPolicy`, default dle typu obsahu:

- v1 režimy: `DISABLED` (nelze spustit rodičem — **default pro klasifikovaný test**), `ALLOWED` (bez dalšího ověření — default pro domácí úkol/procvičování), `REQUIRE_CHILD_PIN` (rodič spustí, dítě zadá PIN).
- Zbylé režimy ze spec (samostatné přihlášení, SSO, jednorázový kód, jen ve škole) jsou dokumentované švy — do enumu až s implementací (rozhodnutí STOP #2 o rezervách).
- „Klasifikovaný test" v1 = zadání s `maxAttempts=1`? NE — explicitně: nový sloupec se nastavuje per zadání v UI učitele („Další možnosti"), default `DISABLED` pro všechna zadání testů, dokud učitel nezvolí jinak. Procvičování (bez zadání) policy nemá — řídí ho oprávnění vztahu `START_PRACTICE`.

### 2.4 PIN vynucení (navazuje na Etapu B)

`REQUIRE_CHILD_PIN`: POST spuštění nese `pin`; server ověří bcrypt hash, při chybě inkrementuje `pinFailedCount`, po **5** chybách `pinLockedUntil = now()+15 min` (reset úspěchem nebo školním resetem). PIN se nikdy neloguje, nevrací, neukládá jinak než hashem; chybová hláška nerozlišuje „špatný PIN" vs „zamčeno"? — ROZLIŠUJE lidsky („Zkuste to za chvíli") bez úniku detailů.

## 3. Tok „Spustit pro Matěje"

1. Rodič v rodinném prostoru zvolí aktivitu → `POST /guardian/student-sessions` `{studentId, assignmentId, assistanceDeclared?, pin?}`.
2. Server ověří (bod 13, v tomto pořadí): VERIFIED vztah + `START_*` oprávnění (GuardianAccessGuard vzor) → aktivita existuje, patří dítěti (enrollment/adresné zadání), org souhlasí → policy zadání povoluje rodičovské spuštění → PIN, pokud ho policy žádá → žádná jiná ACTIVE relace dítěte (jinak ji ukončí, pokud ji spustil týž rodič; cizí ACTIVE → 409).
3. Vytvoří `LearningSession` ACTIVE + audit `GUARDIAN_SESSION_STARTED` → vydá žákovské tokeny (access TTL = zbytek relace, refresh se NEVYDÁVÁ — relace se neobnovuje) s claimem `learningSessionId` → přepíše auth cookies.
4. Klient přejde do celoobrazovkového žákovského režimu s trvalým pruhem: „Režim žáka: Matěj · Spuštěno rodičem · Ukončit". Pruh nesmí překrýt parťáka; věkový režim dle ročníku dítěte.
5. Dítě pracuje běžnou answering pipeline (beze změn); `finish()` jen doplní `learningSessionId` ze JWT claimu (jediný dotyk pipeline — WHERE-safe, viz §5).
6. „Ukončit žákovský režim" → `POST /guardian/student-sessions/:id/end` (smí dítě v relaci i rodič) → status ENDED + smazané auth cookies + **vyčištění klientského stavu** (storage/cache — e2e scénář sourozenců) → obrazovka „Předejte zařízení rodiči" s přihlášením (e-mail předvyplněný, heslo znovu). Expirace = stejný konec automaticky.

## 4. API (bod 18)

- `POST /guardian/student-sessions` — vytvoření (viz §3); nikdy generický login-as.
- `POST /guardian/student-sessions/:id/end` — ukončení (dítě v relaci / iniciátor / škola).
- `GET /guardian/student-sessions/active?studentId=` — pro rodinný prostor (indikace běžící relace).
- Učitel: detail výsledku (`getStudentResult`) + přehled odevzdání nesou provenance blok.
- Škola/učitel v UI zadání: „Další možnosti" → volba `GuardianLaunchPolicy`.

## 5. Dotčená místa mimo nový modul

1. `jwt.strategy` — validace `learningSessionId` claimu (ACTIVE ∧ neexpirované; jinak 401 `SESSION_ENDED`), + zákaz refresh flow pro session tokeny.
2. `submissions.service.finish()` — zápis `learningSessionId` z claimu (pouze přidaný sloupec v datech, žádná změna logiky/zámků).
3. `assignments` DTO/UI — `guardianLaunchPolicy` (default DISABLED pro testy).
4. Věkový režim — guardian session ignoruje `?mode=` override.
5. Audit: `GUARDIAN_SESSION_STARTED/ENDED/EXPIRED/REVOKED`, `CHILD_PIN_VERIFIED/FAILED/LOCKED` (bez PIN hodnot).

## 6. Testovací matice (bod 19 — všech 8 scénářů)

1. Oprávněné spuštění: vztah+oprávnění → relace vznikne, výsledek patří dítěti, audit nese iniciátora.
2. Cizí `studentId` v requestu → 403/404, nevznikne session ani submission.
3. Cross-tenant → 404.
4. Test s `DISABLED` policy → 409 s kódem, klient ukáže lidské vysvětlení.
5. PIN: správný ověří (verificationMethod=PIN), špatný ne, 5× → zámek 15 min, hash nikdy v odpovědi/logu.
6. Sourozenci: druhá relace ukončí první (týž rodič), stav se nepromíchá; partial unique přímým SQL.
7. Návrat: ukončená relace ⇒ žákovský token okamžitě 401; rodičovská část vyžaduje nové heslo; back button neobnoví nic.
8. Provenance: učitel vidí „spustil rodič / ověření / pomoc"; rodič interní audit nevidí; NULL = samostatně.

## 7. Rozhodnutí STOP #3 (21. 7. 2026)

1. **TTL 60 min bez obnovy ✅** + explicitní chování expirace mid-aktivita: rozpracovaná práce je uložená (autosave pipeline, beze změn), dítě dostane lidskou hlášku („Čas vypršel — nic se neztratilo. Předej zařízení rodiči."), nové spuštění téhož zadání **navazuje na rozpracovaný pokus** (existující nedokončená submission se znovu použije) — **nikdy nevzniká nový pokus**.
2. **Návrat heslem v1 ✅**; návratová obrazovka srozumitelná i dítěti (kdo ji vidí a co má udělat — „Předej zařízení rodiči").
3. **V1 jen konkrétní zadání ✅** — volné procvičování/dashboard dítěte až s practice-mode vertikálou. Důsledek: `LearningSession.assignmentId` je v1 povinné a enum aktivit se nezavádí (žádné rezervy); „typ" nese policy zadání.
4. **Úkoly default ALLOWED, učitel může zpřísnit ✅** — s implementační poznámkou: doména v1 nerozlišuje „domácí úkol" vs „klasifikovaný test" (obojí je zadání testu), proto je **DB default `DISABLED`** (neporušitelný princip 4 nedovoluje, aby klasifikovaný test byl rodičovsky spustitelný jen proto, že učitel na volbu nesáhl) a volba „Povolit rodičovské spuštění (domácí úkol)" je přímo ve vytvoření zadání — učitel úkol povolí jedním přepínačem. Až doména rozlišení získá, default pro úkoly se překlopí na ALLOWED.
