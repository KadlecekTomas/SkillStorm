# Izolace testovací databáze

## Proč

Během e2e běhu se v minulosti vymazala dev databáze: test setup zdědil dev
`DATABASE_URL` z shellu a spustil `prisma migrate reset --force`. Tato vrstva
zaručuje, že se to už nemůže stát.

## Pravidla

1. **Testy se konfigurují výhradně přes `DATABASE_URL_TEST`.**
   Zděděná `DATABASE_URL` (shell, dev `.env`, CI job env) je v testovacím
   setupu (`server/test/jest-env.js`, `client/playwright.config.ts`)
   **zahozena** a nikdy se nepoužije.
2. **Název testovací databáze musí být na explicitním whitelistu** —
   povolen je pouze `skillstorm_test` (sufix `_test` je nutná, ale ne
   postačující podmínka; `skillstorm_production_test` neprojde). Rozšíření
   whitelistu vyžaduje úpravu kódu `server/scripts/db-safety.js`, ne env.
   Guard (`assertTestDatabaseUrl`) běží před každou destruktivní operací:
   - `server/test/jest-env.js` — vstupní bod všech jest běhů,
   - `server/test/jest-setup-after.js` — před `DROP SCHEMA` a `prisma migrate reset`,
   - `server/test/global-teardown.js` — před úklidem schémat,
   - `server/prisma/seed/e2e-seed.ts` — seed maže tabulky,
   - `server/scripts/assert-test-db.js` — preflight `npm run start:e2e`
     (backend, proti kterému běží Playwright),
   - `client/playwright.config.ts` — URL pro webServer.
3. **Guard nelze obejít žádnou env proměnnou ani flagem.** Nečte
   `process.env`, rozhoduje jen podle názvu databáze v předané URL. Pokud
   opravdu potřebuješ destruktivní příkaz proti jiné DB (např. vědomý
   restore), udělej to ručně přes `psql`/`pg_restore` mimo testovací tooling.

## Lokální setup

Varianta A — lokální Postgres (výchozí, `.env.test.example`):

```bash
createdb -h localhost -p 5432 -U postgres skillstorm_test
cp server/.env.test.example server/.env.test
```

Varianta B — vyhrazený Docker kontejner (vlastní port 5434 a volume):

```bash
docker compose --profile test up -d postgres-test
# v server/.env.test pak:
# DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5434/skillstorm_test?schema=public
```

Dev databáze (`skillstorm`, docker port 5433 dle `server/.env`) zůstává
testy zcela nedotčená.

## Spouštění

- Backend e2e: `cd server && npm run test:e2e` — setup si sám udělá
  `migrate reset` na testovací DB.
- Fullstack Playwright: `cd client && npm run test:e2e` (nebo `./run-e2e.sh`)
  — backend se startuje přes `start:e2e`, který odmítne nastartovat proti
  ne-testové DB. Canonical seed: `cd server && DATABASE_URL_TEST=... npm run prisma:seed`.

## CI

Workflow soubory (`ci.yml`, `e2e.yml`, `ci-seed-validate.yml`) používají
service container s databází `skillstorm_test` a nastavují `DATABASE_URL`
i `DATABASE_URL_TEST` na stejnou hodnotu.

## Regresní testy guardu

`server/test/security/db-safety-guard.spec.ts` — mimo jiné ověřuje, že guard
nejde obejít env proměnnými a že v chybách neuniká heslo z URL.
