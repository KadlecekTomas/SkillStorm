# CI — workflows, gate a branch protection

Stav po `fix/ci-infrastructure` (2026-07). Cíl: **main je kompletně zelený** —
žádný job, který „selhává normálně". Mrtvý job je horší než žádný: přestane se
číst a maskuje skutečné regrese.

## Workflows

| Workflow | Job(y) | Co hlídá |
|---|---|---|
| `ci.yml` (SkillStorm CI) | `build` | FE build + FE component policy, BE typecheck/build, `test:policy` (RBAC scorecard), seed, RBAC testy BE/FE, gamifikace, dekorátorový check |
| | `Onboarding invariant (backend E2E)` | kontrakt registrace + přístup do PENDING org (jest e2e proti čerstvé DB) |
| | `Onboarding invariant (frontend E2E)` | create-org flow v prohlížeči: routing + `context.mode` (production-mode backend) |
| `e2e-scenarios.yml` | `Playwright scenarios (real browser + backend)` | deterministická fullstack sada (`client/tests/scenarios`): lifecycle, věkové režimy, souběh, security, mobil, bleskovky |
| `ci-seed-validate.yml` | `seed-and-validate` | integrita seed pipeline |
| `frontend-ci.yml` | `Frontend Quality Gate` | lint + typecheck + unit FE |
| `production-gate.yml` | 4 joby | produkční buildy obou stran, Prisma validate, env/Docker konfigurace |

## Smazané workflows

### `e2e.yml` (Fullstack E2E) — smazáno 2026-07

Důvody:
- **30/30 posledních runů červených**; poslední zelený běh nedohledatelný.
- Spouštěl legacy suitu `client/tests/e2e` (24 spec souborů), která driftovala
  přes několik vln API hardeningu — stejný příběh jako karanténa
  `server/test/e2e-legacy` (viz její README).
- Jeho seed pipeline (`seed:full` + `prisma:seed`) je nekompatibilní s DB
  triggerem imutability odevzdání (`SUBMISSION_LOCKED`) — cleanup seedu padá
  dřív, než se testy vůbec spustí.
- Pokrytí nahrazeno: deterministická scénářová sada `e2e-scenarios.yml`
  (reálný prohlížeč + backend) + server e2e gate (47 suites) + onboarding
  invarianty v `ci.yml`.

Legacy suita `client/tests/e2e` zůstává v repu pro lokální použití
(`onboarding-create-org.spec.ts` z ní běží v CI jako onboarding invariant);
návrat kterékoli další suity do gate = opravit podle vzorů ve scénářové sadě.

## Známé pasti (ať se to nerozbije znovu)

- **Playwright startuje `webServer` PŘED `globalSetup`** — na čerstvé CI DB
  musí před suitou proběhnout explicitní `prisma migrate deploy`, jinak
  backend spadne v `onModuleInit` (RBAC sync sahá na tabulky).
- **`NODE_ENV=production` validuje env** (`bootstrap.utils.ts`):
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `DATABASE_URL`,
  `METRICS_INGEST_KEY`, `PUBLIC_APP_URL`, `API_URL`. CI používá syntetické
  hodnoty přímo ve workflow — nejsou to tajemství, do repo secrets nepatří
  nic produkčního.
- **`prisma:seed` ≠ bootstrap seed**: `prisma:seed` = e2e dataset
  (`prisma/seed/e2e-seed.ts`); superadmina a E2E onboarding usera vytváří
  `seed:bootstrap` (`prisma/seed.ts`).
- **`test:policy` bootuje celou aplikaci přes `src/main.ts`** pod vitestem —
  CJS default-importy musí mít interop (viz `cookieParser` shim v main.ts)
  a vitest alias mapa musí znát `@/` i `src/`.
- **AuditLog má runtime immutability middleware** — testovací cleanupy ho
  obcházejí raw SQL (`DELETE FROM audit_logs`), nikdy přes Prisma client.

## Branch protection — doporučené required checks pro `main`

Nastavit v Settings → Branches → `main` → Require status checks:

**Required (blokují merge):**
1. `build` (SkillStorm CI) — největší záběr: buildy, policy scorecard, RBAC
2. `Onboarding invariant (backend E2E)`
3. `Onboarding invariant (frontend E2E)`
4. `Playwright scenarios (real browser + backend)` — jediný fullstack gate
5. `seed-and-validate`
6. `Frontend Quality Gate`
7. `Backend Typecheck and Build` (Production Gate)
8. `Frontend Typecheck and Build` (Production Gate)
9. `Prisma Validate and Generate` (Production Gate)
10. `Env and Docker Production Config` (Production Gate)

**Doporučená doplňková pravidla:** Require branches to be up to date before
merging (checky běžely proti aktuálnímu mainu) + Do not allow bypassing the
above settings.

Zásada údržby: jakmile nějaký required check začne padat „normálně", je to
P1 — buď se opraví, nebo se s odůvodněním odstraní. Nikdy se nenechává červený.
