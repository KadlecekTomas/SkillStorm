# SkillStorm — Monitoring & Alerting Runbook

> **Status:** `CURRENT / RUNBOOK`  
> **Owner:** Engineering + Operations  
> **Last verified:** 2026-08-07  
> **Scope:** current health/version endpoints, Sentry error capture, structured logs and minimum production alerting expectations  
> **Executable authority:** current server/client instrumentation and health implementation. Hosting-provider alert configuration must be verified in the target environment before release.

---

## 0. Goal

Production monitoring must answer quickly:

```text
Is the application reachable?
Can the backend reach PostgreSQL?
Is a Prisma migration stuck?
Is Redis healthy when configured?
Did a new release increase errors?
Are critical operations failing?
Are backups/restores becoming stale?
```

A dashboard with no actionable alert path is not sufficient production monitoring.

---

# 1. Public health and version endpoints

Current backend exposes:

```text
GET /health
GET /version
```

Both are public operational endpoints and must not expose credentials, tenant data or user PII.

## `/health`

Current successful payload shape includes:

```json
{
  "status": "ok",
  "timestamp": "<ISO timestamp>",
  "version": "<package version>",
  "commitHash": "<commit or null>",
  "checks": {
    "process": "ok",
    "db": "ok",
    "migrations": "ok",
    "redis": "ok|disabled"
  },
  "lastMigration": "<migration name or null>"
}
```

Current checks:

- PostgreSQL: `SELECT 1` through Prisma;
- migrations: detects a Prisma migration recorded as started but not finished;
- Redis/cache: probed only when `REDIS_URL` is configured; otherwise reports `disabled`.

A configured Redis failure makes health fail rather than silently reporting `disabled`.

### Important nuance

If the migration-health query itself cannot be executed for a non-domain reason, current code logs a warning and returns `lastMigration: null`; the health endpoint is therefore not a substitute for deployment-time `prisma migrate deploy` verification.

## `/version`

Returns application version + commit hash when available. Use it during incident/release verification to identify the running build.

---

# 2. Uptime alerting

Production should probe `/health` from outside the application hosting process.

Recommended baseline:

- interval: about 1 minute;
- alert on repeated timeout/non-2xx rather than one transient packet loss;
- escalation target must be an actually monitored channel/person;
- record recovery time and incident cause for material outages.

The exact provider/tool is deployment-specific. Do not encode a provider's current pricing or feature limits in this runbook.

### Release smoke check

After deployment verify:

```text
[ ] /version reports expected commit
[ ] /health returns healthy DB/migrations state
[ ] authenticated application smoke test succeeds
[ ] no new high-severity error spike appears
```

---

# 3. Sentry

Current project contains server and browser Sentry instrumentation.

Representative environment controls include:

```text
SENTRY_DSN
SENTRY_ENVIRONMENT
COMMIT_SHA

NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_SENTRY_ENVIRONMENT
NEXT_PUBLIC_COMMIT_SHA
```

No DSN should make instrumentation fail open into sending data elsewhere; it should remain disabled/no-op according to current implementation.

### Source maps

If production source maps are uploaded to Sentry, credentials such as `SENTRY_AUTH_TOKEN` belong in protected CI/deployment secrets, never committed documentation or client bundles.

The exact upload command depends on the current build/deployment pipeline and Sentry project configuration; verify it during deployment setup rather than copying a stale one-off command.

---

# 4. PII / school-data logging policy

School and pupil data must be minimized in telemetry.

Current Sentry hardening is designed around:

- `sendDefaultPii: false`;
- stripping request headers/cookies/body where configured;
- reducing user context to an opaque internal ID where possible;
- e-mail redaction;
- removing local-variable/context-line leakage from stack frames where configured;
- allowlisting safe context categories.

Relevant regression coverage includes server/client Sentry-scrubbing tests.

### Rule for application errors

Do not construct error messages containing pupil names, raw e-mails, answers, tokens or private school content merely because a scrubber exists.

Redaction is a second line of defence; **data minimization at the log call is the first**.

---

# 5. Structured operational logs

Critical events should be structured, machine-searchable and free of unnecessary PII.

Current code includes structured/loggable events around areas such as:

- authentication success/failure;
- submission completion;
- soft deletion;
- privacy/anonymization actions;
- server errors;
- academic-year operations.

Database audit logs are a separate domain from runtime logs. One does not replace the other.

### Correlation

Where current middleware/request context provides a request/correlation ID, preserve it through error handling so an HTTP failure can be correlated with runtime logs without logging the full request body.

---

# 6. Minimum production alerts

Before a real school production release, alerting must cover at least:

| Signal | Required response |
| --- | --- |
| `/health` unavailable / DB check failing | service incident |
| stuck/unfinished migration | deployment incident; do not continue normal rollout |
| configured Redis unhealthy | service/dependency incident |
| sustained server error-rate spike | investigate release/runtime regression |
| authentication failure anomaly | investigate auth/provider/abuse issue |
| backup freshness/off-host copy failure | operational blocker; see backup runbook |
| restore drill failure | recovery-readiness blocker |
| disk/storage/provider capacity risk where applicable | prevent service/data-loss incident |

Exact thresholds require production traffic baseline. Do not claim arbitrary local-development thresholds as production SLOs.

---

# 7. Security monitoring

Monitoring must not become a surveillance feature.

Collect operational/security signals needed to protect the service, but do not add pupil behavioral telemetry simply because it is technically observable.

For security-sensitive events, prefer:

```text
action type
internal opaque IDs
organization ID where justified
timestamp
coarse failure reason
request/correlation ID
```

Avoid raw payloads, answers, guardian messages, audio, tokens and other content unless a separately reviewed incident/audit use case requires it.

---

# 8. Incident workflow

For a material production alert:

```text
1. identify affected environment + running commit
2. confirm alert with /health, logs and provider state
3. stop harmful writes/deployment if data integrity is at risk
4. establish scope and start time
5. mitigate/rollback according to the relevant runbook
6. verify recovery with health + real application smoke test
7. document root cause and permanent follow-up
```

Do not repeatedly restart/redeploy an unknown failure if doing so can destroy forensic evidence or amplify a migration/data problem.

---

# 9. Change gate

A change to health, telemetry, logging or error capture is complete only when:

```text
[ ] no new sensitive data is logged/sent unintentionally
[ ] health payload remains non-sensitive
[ ] dependency failure semantics are tested
[ ] Sentry scrub tests remain green where affected
[ ] release/commit identification remains available
[ ] external alert configuration is updated if signal names/paths change
[ ] this runbook is updated in the same PR
```

---

## Final invariant

> **SkillStorm monitoring must make service/data-integrity failures visible early while collecting the minimum school/pupil information necessary to operate and secure the platform.**