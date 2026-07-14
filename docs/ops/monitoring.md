# Monitoring a error tracking

## Sentry

**Server** (`@sentry/node`, init v `server/src/main.ts`):

| Env | Význam |
|---|---|
| `SENTRY_DSN` | zapíná Sentry; bez něj no-op |
| `SENTRY_ENVIRONMENT` | default `NODE_ENV` |
| `COMMIT_SHA` | release tag eventů |

**Klient** (`@sentry/browser`, init v `client/src/instrumentation-client.ts`,
Next 15.3 instrumentation — žádný build wrapper):

| Env | Význam |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | zapíná browser Sentry |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | default `NODE_ENV` |
| `NEXT_PUBLIC_COMMIT_SHA` | release |

**Sourcemapy:** `productionBrowserSourceMaps: true` v `next.config.ts`
(mapy se generují do `.next/static/**.map`). Upload do Sentry (volitelný,
vyžaduje `SENTRY_AUTH_TOKEN`):

```bash
npx @sentry/cli sourcemaps upload --org <org> --project <proj> \
  --release "$NEXT_PUBLIC_COMMIT_SHA" client/.next/static
```

### PII scrubbing (GDPR)

Jména žáků a e-maily NESMÍ odejít do Sentry. Oba SDK běží se
`sendDefaultPii: false`, `maxBreadcrumbs: 0` a `beforeSend` scrubberem
(`server/src/infra/sentry-scrub.ts`, `client/src/lib/sentry-scrub.ts`):

- request (URL/hlavičky/cookies/body), breadcrumbs a `extra` se zahazují celé,
- user se redukuje na opaque `id`,
- e-maily se regexem nahrazují `[email]` ve zprávách i exception values,
- stack frames ztrácejí `vars` (LocalVariables!) a context lines (zdrojáky),
- contexts se whitelistují (runtime/os/app/device/trace/browser).

**Politika chybových zpráv:** do `throw new Error(...)` nikdy nevkládat
jména uživatelů — jméno nelze scrubbovat vzorem. E-mail scrubber chytí.

**Ověření:** `server/test/security/sentry-scrubbing.spec.ts` (reálné SDK →
mock ingest, assert: chyba dorazila, PII ne) a
`client/src/tests/sentry-scrub.spec.ts` (reálný BrowserClient + stub
transport). Oba běží v gate.

## Health endpoint (uptime monitoring)

`GET /health` (public) — 200 jen když je vše v pořádku, jinak 503:

```json
{
  "status": "ok",
  "version": "0.0.1",
  "commitHash": "abc123",
  "checks": { "process": "ok", "db": "ok", "migrations": "ok", "redis": "ok|disabled" },
  "lastMigration": "20260714090000_enforce_enrollment_org_consistency"
}
```

- `db` — `SELECT 1` přes Prisma,
- `migrations` — 503, pokud existuje migrace started-but-not-finished
  (spadlý deploy) — monitor alertuje dřív, než uživatelé narazí na drift,
- `redis` — `disabled`, pokud není nakonfigurován.

Doporučení: uptime check na `/health` každou minutu, alert při 503/timeout.

## Strukturované logy kritických operací

JSON na stdout (sbírá je platforma hostingu):

| event | kde | pole |
|---|---|---|
| `auth_login_success` / `auth_login_failed` | auth.service | `userId`, `organizationId` / `reason` (bez e-mailu!) |
| `submission_finish` | submissions.service | `submissionId`, `durationMs` |
| `test_soft_deleted` | tests.service | `testId`, `organizationId`, `actorUserId` |
| `user_anonymization_started` | privacy.service | `userId`, `triggeredBy` |
| `server_error` | exception filter | `requestId`, `error` |
| `ACADEMIC_YEAR_*` | academic-years.service | `organizationId`, `yearId`, actor |

Mutace navíc končí v DB audit logu (`AuditService`, `PLATFORM_MUTATION:*`).
