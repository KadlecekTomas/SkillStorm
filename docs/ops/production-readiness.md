# Production readiness — stav k 2026-07-14

Branch `feature/production-hardening`. Souhrn po blocích 1–7, limity
systému, co zbývá, doporučený hosting.

## Co je hotové

### 1. Izolace testovací databáze
Destruktivní test tooling (migrate reset, DROP SCHEMA, e2e seed) projde jen
proti whitelistované DB `skillstorm_test`; konfigurace výhradně přes
`DATABASE_URL_TEST`, guard bez bypassu (`server/scripts/db-safety.js`).
Kořen původního incidentu (auto-load `server/.env` Prisma klientem) uzavřen.
Dokumentace: `docs/testing/test-database-isolation.md`.

### 2. Zálohy s ověřeným restore
`scripts/ops/backup-db.sh` (pg_dump -Fc, sha256, rotace 7 denních +
4 týdenní) + `scripts/ops/restore-db.sh` (checksum, interaktivní potvrzení
pro ne-testové cíle). Restore ověřen smoke testem s běžící aplikací.
Runbook: `docs/ops/backup-restore.md`. **Zbývá:** nasadit cron na hostingu
a offsite sync `$BACKUP_DIR` (S3/rsync).

### 3. Souběh submission flow
`SELECT … FOR UPDATE` + re-read v transakci (updateResponses i finish),
idempotentní double-submit, DB trigger `responses_lock_after_submit` jako
druhá linie + canary test na jeho existenci. Zátěžový test: 30 žáků
paralelně — žádná ztracená odpověď, deadlock ani 5xx.
Dokumentace: `docs/submissions-concurrency-and-locking.md`.

### 4. Limity dotazů a pagination
Audit všech 85 `findMany` bez limitu (`docs/ops/query-limits-audit.md`):
18 provozně rostoucích dostalo cap, listy paginují, dashboardy jsou
agregační s capem 2000 submissions.

### 5. Rate limiting a RBAC
- **Opraven kritický bug:** throttler v5 měří ttl v ms — dosavadní limity
  byly okna v desítkách ms (= žádná ochrana). Nyní `seconds()` všude,
  behaviorální 429 testy v gate.
- `TRUST_PROXY` pro korektní per-IP limity za proxy (Render/nginx).
- Return-URL po expiraci session i v `authClient` větvi.
- RBAC: všechny controllery kryté (`npm run check:rbac` zelený; platform
  stack + 2 zdůvodněné inline výjimky).
- Multitenancy/401/403: tenant-scope-fortress, submissions-student-isolation,
  multi-org-security, RBAC matice — v gate.
- **Opraveny cross-tenant oracles** (assignability diagnostika před tenant
  checkem) a enrollment org-konzistence vynucená DB triggerem v migracích.

### 6. Observabilita
Sentry server+klient s GDPR scrubbingem (jména/e-maily žáků neodejdou —
ověřeno reálnými SDK proti mock ingestu), `/health` s DB + migracemi +
verzí, strukturované JSON logy kritických operací.
Runbook: `docs/ops/monitoring.md`.

### Testovací gate (lokálně reprodukovatelný)
- server: typecheck, lint (0 errors), unit 297, e2e 385 + 1 dokumentovaný
  skip (46 suit), zátěžový test.
- klient: typecheck, vitest 165.

## Limity systému (změřeno)

| Scénář | Výsledek |
|---|---|
| 30 žáků současně odevzdává (create/patch/finish) | p95 ≤ 177 ms, max 182 ms, 0 chyb |
| Škola 500 žáků / 2 400 submissions | director dashboard 78 ms cold / 7 ms warm |
| Globální rate limit | 100 req/min/IP (login 10/15 min, register 3/min) |
| DB connections | pool přes `connection_limit` v DATABASE_URL; Postgres default 100 — pro jednu instanci app bohatě |

Extrapolace: jedna instance v pohodě unese souběžné psaní testů nižších
stovek žáků (bottleneck je bcrypt na login špičce a Postgres IO). Pro
>1 000 souběžných žáků: připojit Redis (cache je připravená přes
`REDIS_URL`) a škálovat app horizontálně (stateless, cookies + DB).

## Co zbývá (vědomě mimo tuto větev)

1. **Klientská Playwright sada** — vlastní drift (hardcode portu 3000,
   závislost na `seed:full`, UI posuny); stejná léčba jako backend
   (kritické flow opravit, zbytek karanténa). Izolace DB už platí i pro ni.
2. **Karanténa 29 legacy backend e2e suit** (`server/test/e2e-legacy/`) —
   postupný návrat dle README.
3. **Zálohovací cron + offsite úložiště** na produkčním hostu.
4. **Sentry účet**: vygenerovat DSN, nastavit env, volitelně sourcemap
   upload token.
5. **Full `npm test` v CI** — gate běží lokálně; CI dnes pouští jen výseky
   (rbac + onboarding). Doporučuji přidat job s celou jest sadou.

## Doporučený hosting (EU)

- **Region: EU (Frankfurt)** — GDPR data žáků nesmí opustit EU.
  Render: `region: frankfurt` ve službách i Postgres; alternativně
  Hetzner/OVH + docker-compose.prod.yml.
- **Postgres 15+** managed s denními snapshoty NAVÍC k vlastním pg_dump
  zálohám (dvě nezávislé cesty obnovy).
- **Env checklist (prod):** `NODE_ENV=production`, `DATABASE_URL`,
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (silné, unikátní),
  `COOKIE_SECRET`, `CORS_ORIGINS`, `PUBLIC_APP_URL`, `API_URL`,
  `METRICS_INGEST_KEY`, **`TRUST_PROXY=1`**, `SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_DSN`, `COMMIT_SHA`; **ne**: `DISABLE_CSRF`,
  `DISABLE_THROTTLE`, `ALLOW_PUBLIC_ORG_CREATION` (dle go-to-market).
  Guard `scripts/check-prod-env.sh` běží v production-gate CI.
- **Uptime monitor** na `GET /health` (60 s interval, alert na 503).
- TLS termination na proxy platformy; cookies už jsou httpOnly.
