# E2E Baseline Audit

> **Status:** audit / issue návrh. **Žádné opravy se neimplementují.** Dokument mapuje, proč
> `npm run test:e2e` na aktuálním repu neprochází, a navrhuje realistický plán opravy
> **odděleně** od analytics PR (`feat/analytics-submission-facts`).
>
> **Datum:** 2026-06-16
> **Prostředí:** lokální Postgres `skillstorm_test` @ localhost:5432, `NODE_ENV=test`,
> `jest --config ./test/jest-e2e.config.js --maxWorkers=1`.

---

## 1. Aktuální stav

| Krok | Výsledek |
|---|---|
| `npm run prisma:generate` | ✅ OK |
| `npm run typecheck` (`tsc --noEmit`) | ✅ OK (production `src/` je typově čistý) |
| `npm run lint` (eslint) | ✅ 0 errors, **88 warnings** (vše pre-existing `@typescript-eslint/no-explicit-any`) |
| `npm run test:e2e` (plný baseline) | ❌ **71 failed / 1 passed / 72 suites**; **407 failed / 96 passed / 3 skipped** z 506 testů |
| Izolované analytics-relevantní suity (5) | ✅ **66/66 passed** |
| Branch `feat/analytics-submission-facts` vs `main` | **nezhoršuje stav** — additivní změna (2 nové tabulky) + opravuje 2 stale suity |

**Klíčové pozorování:** `tsc --noEmit` (jen `src/`) je zelené, ale **e2e suity v `test/` se typecheckují
zvlášť přes ts-jest** a tam je drift. Production kód je tedy v pořádku; rozbité jsou **testy** a **infra**.

Měřená flakiness: dva po sobě jdoucí plné běhy daly **69** a **71** failed suites → nedeterministické,
což ukazuje na sdílený zdroj (DB spojení), ne čistě na deterministické compile chyby.

---

## 2. Rozdělení příčin

Failures mají **dvě nezávislé** příčiny. Obě jsou **pre-existing** (červené i na `main`) a **mimo**
analytics branch.

### A) Test / schema / API drift (deterministické, compile-breaking)

Stale e2e specy odkazují na model/API, který se posunul. ts-jest je odmítne zkompilovat → celá suita
„failed to run" ještě před prvním testem. Z plného běhu (agregované TS error kódy):

| TS kód | Výskytů | Typický význam |
|---|---|---|
| `TS2353` | 106 | „Object literal may only specify known properties" — neexistující pole v `*CreateInput`/`*WhereInput` |
| `TS2339` | 34 | property neexistuje na typu |
| `TS2741` / `TS2561` | 26 / 16 | chybějící povinné pole / překlep v poli |
| `TS2322` | 22 | typ není přiřaditelný (např. `string \| null` → `string`) |
| `TS18048` / `TS2532` | 18 / 4 | „possibly undefined" (`noUncheckedIndexedAccess`) |

Konkrétní opakující se vzory (potvrzené v logu / při opravě 2 suit):

- **`Assignment` create bez `yearId`** — `Property 'yearId' is missing` (model vyžaduje `yearId`).
- **`Subject.organizationId` drift** — `Property 'organizationId' is missing` / `does not exist in type
  'SubjectWhereInput'`. `Subject` je dnes globální, vazba na org je přes `OrgSubject` (42× „organizationId
  is missing" v logu).
- **`RegisterMode.INDIVIDUAL` drift** — enum už má jen `CREATE_ORG | JOIN_ORG`; bare-user registrace
  se dělá přes `authAs`.
- **`teacherUser.email` je `string | null`** — `is not assignable to type 'string'` v `login()` helper args.
- **`years[0].id` / `yearA.id` „possibly undefined"** — `noUncheckedIndexedAccess` na indexovaných přístupech.
- **`TeacherClassSection` create bez `yearId`** — povinné pole přidané migrací.
- **Zaniklé routy** — `POST /subjects`, `PATCH /subjects/:id/activation`, `/auth/use-org` two-step
  (login dnes vrací jiný tvar tokenu; aktivace subjectu je přes `OrgSubject.isEnabled`).
- **Publish hardening** — publish dnes vyžaduje `TestAssignment` (topic) **a** neprázdné `allowedGrades`
  (jinak `NO_TOPIC_ASSIGNMENT` / `NO_ALLOWED_GRADES` → 409). Staré specy to nenastavují.
- **Org readiness (R2)** — submission/assign vyžaduje aktuální rok + class section + assignment;
  bare orgy vytvořené přímo přes Prisma to nesplňují (+ orgy musí být `ACTIVE`).
- **Stale akademické roky** — hardcoded 2024–2025 vs. „dnes" 2026 → `YEAR_WINDOW_CLOSED`.

> Tyto vzory už byly úspěšně opraveny ve dvou suitách (`test-flow-hardening`, `submissions.e2e`) —
> viz commit `335a3bb` na analytics branchi. Slouží jako referenční vzor pro zbytek.

### B) Infra problém — DB connection exhaustion (nedeterministické)

V plném běhu se objevuje **837×** chyba:

```
PrismaClientInitializationError:
Too many database connections opened: FATAL: sorry, too many clients already
  at setupDb (test/jest-setup-after.js:63:7)
```

Mechanismus:
- E2E config běží `--maxWorkers=1` (komentář v configu sám přiznává „to avoid 'Too many database
  connections'"), ale **72 suit v jednom procesu** každá bootstrapuje `AppModule` (Nest app + Prisma
  pool) a navíc `jest-setup-after.js` otevírá vlastní Prisma klienta (`connection_limit=2` v URL).
- `forceExit: true` v configu **negarantuje** korektní teardown — pokud suita neudělá `app.close()` +
  `prisma.$disconnect()`, spojení zůstanou otevřená a **kumulují se** napříč suitami.
- Jakmile se vyčerpá Postgres `max_connections` (default 100), **každá další suita padne v `beforeAll`/
  setupDb** na DB init — **včetně zdravých suit** (analytics/submissions/focus/scoring), které
  samostatně dávají 66/66.

**Důsledek:** plný běh nelze brát jako pravdivý signál o jednotlivých suitách — connection exhaustion
maskuje skutečný stav (zdravé suity vypadají jako rozbité).

---

## 3. Doporučené pořadí opravy

Pořadí je záměrné: **nejdřív infra**, pak compile, pak runtime — jinak nelze získat čistý signál.

### Fáze 1 — stabilizovat e2e runner / DB spojení
Cíl: aby plný běh neumíral na `too many clients` a dal pravdivý per-suite výsledek.
- Ověřit, že **každá** suita má `afterAll` s `await app.close()` a `await prisma.$disconnect()`.
- Sjednotit setup/teardown do **jednoho helperu** (`createE2EApp()` / `closeE2EApp()`), který drží
  jednu app instanci a garantuje disconnect.
- Zvážit **sdílení jedné Nest app + jednoho Prisma klienta** napříč suitami (global setup) místo
  per-suite bootstrapu.
- Nastavit `DATABASE_URL` `connection_limit` (Prisma pool) nízko pro test (`?connection_limit=1`) a/nebo
  zvýšit `max_connections` v test Postgresu (CI service / docker `command: -c max_connections=300`).
- Zvážit `--runInBand` (sériově) a/nebo rozdělení e2e do **dávek** (shardů) v CI, aby se spojení nehromadila.
- **Riziko:** nízké–střední (jen test infra). **Hodnota:** vysoká — odblokuje všechno ostatní.
- **Hotovo když:** plný běh doběhne bez jediné `too many clients`, zdravé suity (analytics/submissions/
  focus/scoring) jsou zelené i v plném běhu.

### Fáze 2 — opravit compile-breaking stale suity
Cíl: každá suita se aspoň zkompiluje a spustí (TS chyby blokují běh).
- Začít **typovými chybami** (TS2353/TS2741/TS2322/TS18048) — bez nich se suita ani nespustí.
- Rozdělit po **tematických blocích** (assignment, submission, auth/org-readiness, academic-year,
  catalog/subject, …).
- **Samostatné commity per blok**, ne jeden obří commit (viz §4).
- Použít **referenční vzory** z `335a3bb` (OrgSubject místo `Subject.organizationId`, `authAs` místo
  `RegisterMode.INDIVIDUAL`, `ensureTopicAssignment` + `allowedGrades` před publishem, org `ACTIVE` +
  class section pro R2, dynamické akademické roky, `deleteAssignmentDeep` pro FK RESTRICT).
- **Riziko:** střední (mechanické, ale hodně míst). **Hodnota:** vysoká.

### Fáze 3 — runtime failing suity
Cíl: po vyřešení compile + connection vyřešit suity, které se spustí, ale padají na asserci.
- **Až poté**, co Fáze 1+2 daly čistý signál.
- U každé rozlišit **skutečný produkční bug** vs. **zastaralá fixture/expectace**:
  - skutečný bug → samostatný `fix:` na produkční kód + regresní test,
  - stale fixture → `fix(test):` jen na test.
- **Riziko:** vyšší (může odhalit reálné bugy). **Hodnota:** vysoká (skutečná regresní ochrana).

---

## 4. Doporučená strategie commitů

Malé, tematické, samostatně review-ovatelné commity (ne jeden balík):

```
fix(test-infra): stabilize e2e database connections and teardown
fix(test): repair stale assignment e2e specs
fix(test): repair stale submission e2e specs
fix(test): repair stale auth / org-readiness e2e specs
fix(test): repair stale academic-year e2e specs
fix(test): repair stale catalog / subject e2e specs
fix(test): repair remaining runtime e2e specs
```

Pravidla:
- **Fáze 1 commit jde první** (jinak ostatní nejdou ověřit).
- Každý commit musí **zezelenit svůj blok v izolaci** (`jest <pattern>`).
- Produkční kód měnit **jen** když je to skutečný bug (Fáze 3), v odděleném `fix:` commitu.
- Ideálně **vlastní branch/PR** (`chore/e2e-baseline-green`), oddělené od feature PR.

---

## 5. Doporučení pro analytics PR (`feat/analytics-submission-facts`)

> **Poznámka do popisu PR — kopíruj:**
>
> - Branch prošla **targeted e2e 66/66** (`test-flow-hardening`, `submissions.e2e`,
>   `analytics-submission-snapshot`, `focus-test-session`, `submissions-scoring`) v izolaci.
> - **Full `npm run test:e2e` baseline je pre-existing red i mimo tuto branch** — z důvodu
>   (A) compile driftu ve ~většině e2e suit a (B) DB connection exhaustion (`too many clients`).
>   Obojí je červené i na `main` a **není způsobené touto změnou**.
> - Analytics změna je **additivní** (2 nové tabulky `submission_facts` / `response_facts` + 2 enumy,
>   žádný ALTER existujících tabulek, scalar IDs, žádné back-relations na živé modely).
> - **Oprava e2e baseline NENÍ součástí tohoto PR** — řeší ji samostatný audit/issue
>   (`docs/testing/e2e-baseline-audit.md`) a vlastní `fix(test-infra)/fix(test)` PR.
> - `tsc --noEmit` (production `src/`) ✅, `eslint` 0 errors ✅.

---

## 6. Shrnutí

- **Production kód je zdravý** (`tsc`/`eslint` zelené); rozbité jsou **e2e testy + test infra**, pre-existing.
- **Dvě příčiny:** (A) plošný compile drift stale suit, (B) connection exhaustion v plném běhu.
- **Pořadí opravy:** infra → compile → runtime. Bez Fáze 1 nelze získat pravdivý signál.
- **Analytics PR je čistý** a má jít do review nezávisle; baseline green je samostatný úkol.
