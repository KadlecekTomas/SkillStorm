# SkillStorm Production Readiness Audit

Datum auditu: 2026-06-10

## Executive summary

* Aktuální verdikt: READY FOR PRE-PROD
* Stav P0 hardening iterace 2026-06-10: opraveno pro dokumentaci, env politiku, backend fail-fast validaci, Docker production hardening a CI production gate.
* Architektura: monorepo, modulární monolit. Frontend je Next.js aplikace v `client`, backend je NestJS modulární monolit v `server`, databáze PostgreSQL přes Prisma, Redis pro cache, Docker Compose orchestrace.
* Největší produkční rizika: červený lint gate zůstává mimo tuto iteraci, chybí hlubší tenant isolation/RBAC testy, slabá modelová konzistence u subscription/import/export/assignment polí, neúplné audit entity a nejasná duplicita token revokací.
* Co blokuje plnou produkci: lint cleanup, tenant isolation/RBAC test suite, e2e workflow testy, monitoring/backup/release checklist a P1 datové invarianty.
* Co je nice-to-have: upgrade Prisma 7, update Browserslist/baseline-browser-mapping, sjednocení názvů `orgId`/`organizationId`, odstranění starých alias route a vygenerovaných artefaktů z repozitáře.

## Project map

| Oblast | Stav |
|---|---|
| Frontend | `client`, Next.js 15.3, React 19, Tailwind, Vitest, Playwright. |
| Backend | `server`, NestJS 10, TypeScript, Prisma, Jest/Vitest policy tests. |
| Prisma | `server/prisma/schema.prisma`, 46 migrací, seed skripty v `server/prisma/seed`. |
| Docker | `docker-compose.yml` zůstává pro dev/staging legacy profily; produkce má oddělený `docker-compose.prod.yml`. |
| Env | Reálné `.env` soubory jsou ignorované; `.env.example`, `.env.production.example`, `client/.env.example` a `server/.env.example` jsou trackovatelné placeholder examples. |
| CI/CD | Přidán `.github/workflows/production-gate.yml`; existující `ci.yml`, `frontend-ci.yml`, `ci-seed-validate.yml` zůstávají, lint v dotčených historických workflow je non-blocking do cleanupu. |
| Lokální start | README: `docker compose --profile dev up -d postgres redis`, `seed-full`, poté `backend frontend`. |
| Produkční start | `docker compose --env-file .env.production -f docker-compose.prod.yml up -d`. Produkční compose používá `PROD_*` vstupy a mapuje je na runtime env kontejnerů. |

## Validation results

| Příkaz | Výsledek | Poznámka |
|---|---:|---|
| `npm --prefix server run typecheck` | PASS | `tsc --noEmit` prošel. |
| `npm --prefix client run typecheck` | PASS | `node ./scripts/typecheck.mjs` prošel. |
| `npm run lint` v `server` | FAIL | 1200 problémů: 1112 errors, 88 warnings; převážně Prettier, ale i unused vars. |
| `npm run lint` v `client` | FAIL | Desítky chyb: unused vars, explicit return types, hook warnings. |
| `npx prisma validate` v `server` | PASS | Schema validní; warning k deprecated `package.json#prisma`. |
| `npx prisma generate` v `server` | PASS | Prisma Client v6.13.0 vygenerován. |
| `npx prisma migrate status` v `server` | PASS | DB `skillstorm` na `localhost:5432`, 46 migrací, up-to-date. |
| `npm run build` v `server` | PASS | `prebuild` generuje Prisma klienta a typecheck, poté `nest build`. |
| `npm run build` v `client` | PASS | Next build prošel, ale build hlásí zastaralý Browserslist; lint je při buildu přeskočen. |
| `npm run test:unit:light -- --runTestsByPath src/auth/token.util.spec.ts src/submissions/submission-scoring.spec.ts` | PASS | 2 suites, 7 tests. |
| `npm run test:unit -- --run tests/fe-policy/components/LoginForm.test.tsx src/tests/post-auth-policy.spec.ts` | PASS | 2 files, 19 tests. |
| `docker compose config` | PASS/NEÚPLNÉ | Bez profilu vrací `services: {}` kvůli profilům. |
| `docker compose --profile prod config` | PASS/RISK | Config validní, ale načítá root `.env` s dev secrety a `DISABLE_CSRF=1`. |
| `docker compose -f docker-compose.prod.yml config` | PASS | Ověřeno se syntetickými `PROD_*` hodnotami; Postgres/Redis nemají publikované porty, backend není publikovaný, frontend publikuje pouze `PROD_FRONTEND_PORT`. |
| `scripts/check-prod-env.sh` | PASS | Ověřeno se syntetickými `PROD_*` hodnotami; guard kontroluje zakázané fallback secrety, CSRF/Swagger, slabé markery a DB/Redis porty. |
| `scripts/check-no-committed-env.sh` | PASS | Ověřuje přes `git ls-files`, že nejsou trackované reálné `.env` soubory. |
| `npm --prefix server run test:e2e -- --runTestsByPath test/e2e/tenant-scope-fortress.e2e-spec.ts` | PASS | 15/15 tenant isolation/RBAC negativních e2e testů prošlo; sada odhalila a pokrývá opravu priority org-scoped RBAC policy proti globálnímu fallbacku. |

## P0 hardening update 2026-06-10

| Oblast | Stav | Poznámka |
|---|---|---|
| Dokumentace | OPRAVENO | `.gitignore` už neignoruje `docs/`, takže `docs/production-audit.md` a `docs/production-roadmap.md` jsou trackovatelné. |
| Env politika | ČÁSTEČNĚ OPRAVENO | Reálné `.env`, `.env.local`, `.env.production`, `.env.test`, `.env.development`, `.env.staging` a `.env.*.local` jsou ignorované. Example soubory používají placeholdery místo použitelných secretů. |
| Trackované env soubory | OPRAVENO PRO NOVÉ COMMITY | `server/.env.test` byl trackovaný a byl odebrán z indexu bez smazání lokálního souboru. Aktuálně trackované zůstávají pouze example soubory. |
| Rotace secretů | NUTNÁ PODMÍNĚNĚ | Root `.env` nebyl podle `git ls-files` trackovaný, ale `server/.env.test` trackovaný byl. Všechny hodnoty, které se kdy objevily v trackovaných env souborech nebo sdílených example souborech jako použitelné hodnoty, považovat za kompromitované a nepoužívat v produkci. |
| Backend production validation | OPRAVENO | Produkce vyžaduje `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` a failne na slabých/default secretech nebo `DISABLE_CSRF=1`. |
| CSRF | OPRAVENO | Auth používá httpOnly cookies pro access/refresh tokeny, proto je CSRF v produkci povinné. `DISABLE_CSRF=1` je povolené pouze mimo produkci. |
| Docker hardening | OPRAVENO | Přidán `docker-compose.prod.yml` bez dev profilů, bez `env_file: .env`, bez legacy `JWT_SECRET`, bez publikovaných DB/Redis portů, bez Swaggeru a s `DISABLE_CSRF=0`. |
| CI production gate | OPRAVENO | Přidán `.github/workflows/production-gate.yml` pro backend/frontend typecheck+build, Prisma validate/generate, Docker prod config, `check-prod-env.sh` a `check-no-committed-env.sh`. |

## P0 – blokery produkce

| Oblast | Problém | Důkaz v kódu | Dopad | Návrh opravy | Odhad náročnosti | Riziko opravy |
|---|---|---|---|---|---:|---|
| Security / secrets | Reálné env soubory nesmí být trackované; `server/.env.test` byl trackovaný a byl odebrán z indexu. | `git ls-files` aktuálně vrací pouze `.env.example` a `server/.env.example`; `server/.env.test` je staged removal. | Dříve trackované hodnoty nelze považovat za tajné. | Před produkcí rotovat/nepoužít všechny hodnoty z historicky trackovaných env/test env souborů; dokončit Docker/CI secret guard. | S | Nízké |
| Quality gate | Server lint selhává masivně. | `npm run lint` v `server`: 1200 problémů, 1112 errors. | Nelze důvěryhodně vynucovat code quality ani blokovat regresi; CI by měla failovat. | Spustit řízený Prettier/ESLint cleanup v samostatném PR, poté lint povinně v CI. | M | Střední kvůli velkému diffu |
| Quality gate | Client lint selhává. | `npm run lint` v `client`: unused vars, missing return types, hook warnings. | Frontend může obsahovat mrtvý kód a hook dependency regresi; build lint přeskočí. | Opravit ESLint chyby, rozhodnout pravidla pro explicit return type, zapnout lint v CI/build gate. | S-M | Nízké |
| Lint gate | Lint stále není blocking production gate. | `production-gate.yml` lint nespouští; historický lint v `ci.yml`/`frontend-ci.yml` je non-blocking. | Stylové a části statických problémů nejsou release blockerem, dokud neproběhne cleanup. | Projít samostatný lint cleanup a poté lint vrátit jako blocking gate. | M | Střední |

## P1 – důležité před spuštěním

| Oblast | Problém | Důkaz v kódu | Dopad | Návrh opravy | Odhad náročnosti | Riziko opravy |
|---|---|---|---|---|---:|---|
| Auth tokens | Runtime refresh tokeny jsou hashované, ale DB pole se stále jmenuje `token`; `RevokedToken` používá `token` bez hash naming a vypadá duplicitně. | `server/src/auth/token.util.ts:3`, `server/src/auth/auth.service.ts` používá `hashToken`; `schema.prisma:312-334`. | Vysoké riziko budoucího plaintext ukládání nebo nekonzistentní revokace. | Přejmenovat DB/API koncept na `tokenHash`, sjednotit revokaci na `RefreshToken.revokedAt` nebo jasně definovat `RevokedToken` pro access token JTI/hash. | M | Střední |
| Default passwords | Organizace má šablonu výchozího hesla. | `server/prisma/schema.prisma:99-105` `initialPassword @default("ChangeMe!{yy}")`. | Hromadné importy žáků mohou vytvořit předvídatelná hesla. | Generovat jednorázová náhodná hesla nebo magic invite/reset flow; šablonu nepoužívat pro produkční hesla. | M | Střední |
| DB constraints | `User.email` i `User.username` jsou nullable a unikátní odděleně. | `schema.prisma` model `User`: `email String? @unique`, `username String? @unique`. | Lze vytvořit uživatele bez stabilního login identifikátoru, pokud service validace selže. | Přidat DB constraint nebo aplikační invariant test, že alespoň jeden identifikátor existuje. | M | Střední |
| RBAC | Permission enum je úzký pro reálný SaaS. | `schema.prisma:1119-1138` neobsahuje billing, org settings, audit export, support admin, content moderation, import/export odděleně. | Role budou příliš hrubé nebo obcházené přes system role. | Rozšířit permission matrix, odlišit platform permissions a org permissions. | M | Střední |
| Audit log coverage | Audit entity nepokrývají subscription, assignment, submission, import/export, invite, academic year. | `schema.prisma:1207-1218`. | Citlivé akce nemusí být auditovatelné. | Rozšířit `AuditEntityType`, přidat testy pro audit citlivých akcí. | M | Nízké |
| Assignment model | `targetType` a `showExplain` jsou volné stringy. | `schema.prisma:1047`, `schema.prisma:1055`. | Nevalidní hodnoty mohou rozbít business logiku a UI. | Převést na Prisma enum a DTO enum validaci. | S-M | Střední |
| Subscription | `Organization.type` a `SubscriptionPlan.target` nejsou zjevně DB svázané. | `schema.prisma:1195-1205`, subscription model `schema.prisma:291-309`. | Škola může dostat nekompatibilní plán, pokud aplikační validace selže. | Přidat service invariant, test a ideálně checkout/billing state machine. | M | Střední |
| Import/export | CSV import je body string bez upload/file-size vrstvy a parser je vlastní. | `server/src/imports/imports.controller.ts:33-59`, `imports.service.ts:447-519`. | Riziko velkého payloadu, edge-case CSV chyb, DoS a nekonzistence importů. | Zavést body size limit, robustní CSV knihovnu, idempotenci importu, audit a e2e test velkých/škodlivých vstupů. | M | Střední |
| Learning materials | `scope`, `organizationId`, `createdById` dovolují globální obsah s lokálním autorem bez DB invariantu. | `schema.prisma:721-749`. | Možný únik lokálního obsahu nebo špatná viditelnost. | Přidat invarianty: GLOBAL bez org nebo platform author, ORGANIZATION s org; test tenant scopu. | M | Střední |
| Enrollment legacy | `StudentClassroom` zůstává v Prisma schématu jako legacy model vedle `Enrollment`. | `schema.prisma:599-618`, `schema.prisma:752-768`. | Dvě reprezentace vztahu student-třída zvyšují riziko driftu, i když komentář říká read-only trigger. | Ověřit migraci/trigger v DB, přidat test, že aplikace nikam nezapisuje `StudentClassroom`. | S | Nízké |

## P2 – technický dluh

| Oblast | Problém | Důkaz v kódu | Dopad | Návrh opravy | Odhad náročnosti | Riziko opravy |
|---|---|---|---|---|---:|---|
| Prisma | Deprecated `package.json#prisma`; Prisma 7 update available. | `npx prisma validate/generate` warning. | Budoucí upgrade bude bolestivější. | Přidat `prisma.config.ts`, sjednotit verzi `prisma` a `@prisma/client`. | S | Nízké |
| Frontend deps | Browserslist/caniuse a baseline data jsou staré. | `npm run build` warning. | Neaktuální browser targeting. | Aktualizovat lockfile po kontrolovaném test runu. | S | Nízké |
| Repo hygiene | `server/dist`, `client/.next`, `client/playwright-report`, logy/screenshoty jsou v pracovním stromu nebo dohledatelné. | `rg --files` ukazuje build/report artefakty. | Šum v auditu a riziko commitu artefaktů. | Zkontrolovat `.gitignore`, odstranit artefakty z gitu, ponechat jen potřebné reporty. | S | Nízké |
| Naming | Směs `orgId` a `organizationId`. | Prisma modely používají obě varianty. | Vyšší kognitivní náklad, chyby tenant scopu. | Postupně sjednotit na service/API boundary, DB mapování neměnit bez plánu. | M | Střední |

## Security audit

* Auth: login/register/refresh mají throttling (`AuthController`), access token 15 minut, refresh token 7 dní, cookies jsou httpOnly a v produkci secure. Logout rotuje/ruší tokeny.
* RBAC: globální `JwtAuthGuard`, `RbacGuard`, `RolesGuard` jsou registrované v `AppModule`; endpointy používají `@Permission`. Permission model je ale před spuštěním potřeba rozšířit a otestovat proti reálným rolím.
* Multitenancy: většina klíčových modelů má `organizationId`/`orgId`; existují helpery typu tenant scope. Riziko je v nekonzistentním názvosloví, nullable org u platform/global entit a nutnosti testovat IDOR endpoint po endpointu.
* Tokeny: refresh tokeny jsou hashované přes SHA-256 před uložením, password reset token má `tokenHash`. Produkce nově vyžaduje oddělený `JWT_ACCESS_SECRET` a `JWT_REFRESH_SECRET`; legacy `JWT_SECRET` zůstává jen jako neprodukční fallback pro existující lokální konfigurace. Doporučení: přejmenovat DB pole a vyjasnit `RevokedToken`.
* Hesla: bcrypt se používá, ale `OrganizationSettings.initialPassword` zůstává produkční riziko. Env example soubory už nepoužívají použitelné bootstrap heslo.
* Input validation: globální `ValidationPipe` s `whitelist`, `forbidNonWhitelisted`, `transform` je zapnutý. CSV import potřebuje samostatné limity a robustnější parser.
* CORS/cookies: CORS je konfigurovaný přes `CORS_ORIGINS`; auth používá httpOnly cookies (`ss_at`, `ss_rt`) a CSRF double-submit cookie. Backend nově failne, pokud je `NODE_ENV=production` a `DISABLE_CSRF=1`.
* Audit logy: existuje `AuditLog`, audit module a retention service, ale enum nepokrývá všechny kritické SaaS entity.
* Secrets: reálné env soubory jsou ignorované a `server/.env.test` byl odebrán z indexu. Hodnoty z historicky trackovaných env/test env souborů nepoužívat v produkci; produkční hodnoty držet v secret manageru.

## Database audit

* Prisma modely: schema je validní a migrace jsou podle lokální DB aktuální.
* Migrace: 46 migrací; `migrate status` prošel proti lokální DB.
* Constraints: dobré základy u membership, enrollment, class section a assignment students. Chybí DB invarianty pro nullable login identifikátory, content scope a kompatibilitu subscription planu.
* Indexy: běžné tenant indexy existují u organizací, enrollmentů, assignmentů a audit logů. `LearningMaterial` má index jen na `topicLevelId`; pro katalog/org scope budou potřeba indexy podle reálných dotazů.
* Soft-delete: některé modely mají `deletedAt`, jiné ne (`ImportBatch`, `ExportLog`, `SubscriptionPlan`, některé join tabulky). Je potřeba explicitní policy.
* Seed data: seed skriptů je hodně (`seed:full`, `seed:production`, demo seed). Produkční seed nesmí běžet defaultně a musí být idempotentní.

## API audit

* Endpointy: backend je rozdělen do doménových modulů: auth, users, organizations, memberships, classroom, students, enrollments, imports, tests, assignments, submissions, analytics, audit, support, platform.
* DTO: class-validator je použitý a globální ValidationPipe chrání neznámá pole. Lint ale ukazuje formatting a unused problémy v DTO/controller souborech.
* Guards: globální guard stack je silný, plus endpoint-level guards pro academic year a permissions.
* Error handling: globální exception filter v produkci nevrací raw exception message pro 500, ale Prisma meta u constraint chyb může být citlivá podle endpointu.
* Swagger: zapíná se mimo produkci nebo přes `ENABLE_SWAGGER`; compose/root env ho zapíná, což je v prod riziko.

## Frontend audit

* Routing: App Router, protected app/dashboard/platform route skupiny, middleware a guard komponenty.
* Auth: API klient používá cookies, CSRF cookie čte pro state-changing requesty, umí refresh/retry a redirect na login.
* Role-based UI: existují role/permission hooky a RBAC e2e testy; lint chyby v platform/school stránkách musí být vyřešené před release.
* Loading/error/empty states: podle komponent a testů jsou částečně pokryté, ale audit neprokázal konzistentní coverage napříč všemi stránkami.
* API volání: centralizované v `client/src/lib/http/client.ts`, generated OpenAPI klient existuje.
* Hardcoded URL/secrets: API base je přes env/proxy; root env obsahuje dev secrets, frontend compose dědí env proměnné, které nepotřebuje.

## Docker / deployment audit

* Dockerfiles: oba multi-stage buildy existují. Backend entrypoint spouští migrace/seed podle env; frontend běží přes `next start`.
* Compose: healthchecky existují pro Postgres, Redis, backend a frontend.
* Produkční NODE_ENV: `docker-compose.prod.yml` nastavuje `NODE_ENV=production` pro backend i frontend.
* Exposed ports: produkční compose publikuje pouze frontend přes `PROD_FRONTEND_PORT`; backend, Postgres a Redis jsou pouze na interní Docker síti.
* Env zdroj: produkční compose nepoužívá `env_file: .env` a používá `PROD_*` vstupní proměnné, aby nedědil legacy dev názvy z root `.env`. Doporučený příkaz je `docker compose --env-file .env.production -f docker-compose.prod.yml ...`.
* Swagger/CSRF: produkční compose hard-codeuje `ENABLE_SWAGGER=0` a `DISABLE_CSRF=0`.
* Fallback secrety: citlivé hodnoty jsou v compose vyžadované přes `${PROD_*:?message}`; žádné použitelné default secrety nejsou v produkčním compose.

## CI audit

* Production gate: `.github/workflows/production-gate.yml` běží na push a pull request do `main` a `develop`.
* Backend gate: `npm ci`, `npm run prisma:generate`, `npm run typecheck`, `npm run build` v `server`; CI dodává syntetické `DATABASE_URL`, protože čistý runner nemá vygenerovaný Prisma client a `prebuild` spouští Prisma generate znovu.
* Frontend gate: `npm ci`, `npm run typecheck`, `npm run build` v `client`; production build používá syntetické `API_PROXY_TARGET=http://backend:4200`, aby ověřil Docker-like proxy target bez produkčních secrets.
* Frontend MSW policy: mock loader se v produkci nespouští, pokud není explicitně zapnutý přes `NEXT_PUBLIC_ENABLE_MSW=true`; protože loader zůstává dohledatelný build bundlerem, `msw` musí být explicitní devDependency dostupná v build stage.
* Prisma gate: `npx prisma validate` a `npx prisma generate` v `server`; CI dodává syntetické `DATABASE_URL` bez reálných secrets.
* Docker gate: `docker compose -f docker-compose.prod.yml config` běží se syntetickými `PROD_*` hodnotami v workflow env.
* Env guards: `scripts/check-prod-env.sh` a `scripts/check-no-committed-env.sh` běží v CI.
* Secrets: CI nepoužívá reálné produkční secrety; používá dlouhé syntetické hodnoty pouze pro render/validaci konfigurace.
* Clean install parity: server typecheck závisí na explicitních `@types/express`, `@types/passport-jwt`, `@types/cookie-parser` a `@types/uuid` devDependencies.
* Lint: lint není blocking production gate; historické lint kroky v `ci.yml` a `frontend-ci.yml` jsou non-blocking do plánovaného cleanupu.
* Dependency follow-up: `npm audit` zranitelnosti jsou security backlog mimo tento CI parity fix; Prisma `package.json#prisma` warning bude řešen samostatně přes `prisma.config.ts`.
* Migrace při deployi: `RUN_MIGRATIONS` existuje, ale runbook musí popsat rollback, lock a zero-downtime postup.
* Backupy/monitoring: v repu není produkční backup strategie. Sentry je volitelné přes `SENTRY_DSN`, health a metrics moduly existují.

## Production env parity

| Skupina | Proměnné | Poznámka |
|---|---|---|
| Backend runtime env | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `METRICS_INGEST_KEY`, `REDIS_URL`, `PUBLIC_APP_URL`, `API_URL`, `CORS_ORIGINS`, `ALLOW_CROSS_SITE_COOKIES`, `ALLOW_PUBLIC_ORG_CREATION`, `RUN_MIGRATIONS`, `RUN_SEED`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `DISABLE_CSRF`, `ENABLE_SWAGGER` | Produkční compose mapuje z `PROD_*`; `DISABLE_CSRF=0` a `ENABLE_SWAGGER=0` jsou hard-coded guardy. |
| Frontend build-time env | `API_PROXY_TARGET`, `BETA_MODE`, `ENABLE_RBAC_TELEMETRY_CLIENT` | `API_PROXY_TARGET` se vyhodnocuje v `next.config.ts` při `rewrites()` během `next build` i runtime startu. |
| Frontend public env | `NEXT_PUBLIC_BETA_MODE`, `NEXT_PUBLIC_ENABLE_RBAC_TELEMETRY_CLIENT`, volitelně `NEXT_PUBLIC_AUTH_DEBUG`, `NEXT_PUBLIC_ENABLE_MSW`, `NEXT_PUBLIC_API_BASE_URL` | První dvě hodnoty se odvozují v `next.config.ts`; public hodnoty nejsou secrets. |
| Docker input env `PROD_*` | `PROD_DATABASE_URL`, `PROD_JWT_ACCESS_SECRET`, `PROD_JWT_REFRESH_SECRET`, `PROD_COOKIE_SECRET`, `PROD_METRICS_INGEST_KEY`, `PROD_PUBLIC_APP_URL`, `PROD_API_URL`, `PROD_API_PROXY_TARGET`, `PROD_CORS_ORIGINS`, `PROD_ALLOW_CROSS_SITE_COOKIES`, `PROD_ALLOW_PUBLIC_ORG_CREATION`, `PROD_RUN_MIGRATIONS`, `PROD_RUN_SEED`, `PROD_FRONTEND_PORT`, `PROD_ENABLE_RBAC_TELEMETRY_CLIENT`, `PROD_BETA_MODE`, `PROD_SUPERADMIN_EMAIL`, `PROD_SUPERADMIN_PASSWORD` | `PROD_API_PROXY_TARGET=http://backend:4200` je non-secret Docker network config. |
| CI synthetic env | Stejné `PROD_*` vstupy jako production compose plus backend/Prisma `DATABASE_URL=postgresql://skillstorm_ci:skillstorm_ci_password@localhost:5432/skillstorm_ci` a frontend build `API_PROXY_TARGET=http://backend:4200` | Hodnoty jsou syntetické, nereálné a slouží pouze k production gate render/build validaci. |

## Test audit

* Unit testy: existují rozsáhlé Jest/Vitest testy na backend služby a frontend komponenty/policy.
* E2E: Playwright testy existují pro auth, RBAC, multitenancy, seeded core flow, onboarding, logout a hlubší workflowy.
* Ověřeno v auditu: reprezentativní token/scoring unit testy a frontend login/post-auth policy prošly.
* Ověřeno v tenant/RBAC iteraci 2026-06-10: backend `tenant-scope-fortress` e2e sada prochází 15/15 a pokrývá cross-org test read/update, body `organizationId` spoofing, assignment/submission izolaci, cizí class/student přístup, org-scoped RBAC deny a student deny pro teacher/admin endpointy.
* Neověřeno v auditu: plný e2e běh, protože vyžaduje běžící stack/seed a je časově dražší.

Minimální testovací sada před production-ready:

| Oblast | Minimální test |
|---|---|
| Auth | login, refresh rotation, logout, revoked/expired refresh token, password reset token hash. |
| RBAC | každá role: povolené i zakázané endpointy; platform role oddělené od organization role. |
| Multitenancy | IDOR testy pro organization, class, student, test, assignment, submission, audit, import/export. |
| Import/export | CSV validace, duplicate rows, malicious/large payload, idempotentní commit, audit log. |
| Assignment workflow | teacher creates test -> assignment -> student submission -> score/result -> teacher analytics. |
| Subscription | plan compatibility, suspended/past_due gating, feature limits. |
| Frontend | protected routes, role UI, refresh after reload, empty/loading/error states. |
| Deployment | Docker prod config validation, migrations on clean DB, backup/restore smoke. |

## Recommended repair order

1. Tenant isolation / RBAC testy.
2. Lint cleanup po kategoriích a poté blocking lint CI.
3. E2E workflow testy hlavních školních happy pathů.
4. Monitoring, backup a release checklist.
5. P1 datové invarianty: auth/token cleanup, user identity constraint, assignment enums, audit coverage, content scope/subscription compatibility.
