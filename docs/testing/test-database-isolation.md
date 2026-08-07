# SkillStorm — Test Database Isolation

> **Status:** `CURRENT / RUNBOOK`  
> **Owner:** Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** hard safety boundary for destructive Jest, seed and Playwright database operations  
> **Executable authority:** `server/scripts/db-safety.js`, current test setup files and CI workflows.

---

## 0. Why this exists

A historical E2E run inherited a development `DATABASE_URL` and executed destructive reset logic against the wrong database.

SkillStorm therefore treats test-database isolation as a **hard guard**, not a convention.

The current implementation's canonical destructive-test database is:

```text
skillstorm_test
```

The exact whitelist is defined in `server/scripts/db-safety.js`.

---

# 1. Non-negotiable rules

1. Destructive test tooling receives its database through the explicit test configuration path (`DATABASE_URL_TEST` where required by the runner).
2. A caller's inherited development/production `DATABASE_URL` must never silently become the target of destructive test setup.
3. Before destructive operations, `assertTestDatabaseUrl()` verifies the target database name against the **code-level allowlist**.
4. The current allowlist contains `skillstorm_test`.
5. A `_test` suffix alone is insufficient: a name such as `skillstorm_production_test` is rejected unless deliberately added to the code-level allowlist in a reviewed change.
6. There is no environment-variable or CLI bypass for the guard.
7. Deliberate restore/recovery against a non-test database uses the dedicated operations workflow/runbook, not test tooling.

---

# 2. Current guard

`server/scripts/db-safety.js` is the single dependency-free safety module used by destructive test entry points.

Its core contract is:

```text
missing URL                        -> reject
unparseable URL                    -> reject
DB name not ending in _test        -> reject
DB name not on explicit allowlist  -> reject
allowed test DB                    -> proceed
```

Error output redacts connection passwords.

### Change rule

Extending the allowlist is a code/security change. It requires review and regression-test updates; it must never be made configurable by a convenient runtime flag.

---

# 3. Local setup

Use a dedicated PostgreSQL database named `skillstorm_test`.

Example with local PostgreSQL:

```bash
createdb -h localhost -p 5432 -U postgres skillstorm_test
cp server/.env.test.example server/.env.test
```

Then ensure the test environment points `DATABASE_URL_TEST` at that database.

Example shape only:

```text
postgresql://postgres:<local-password>@localhost:5432/skillstorm_test?schema=public
```

Do not copy local credentials into committed files.

If a Docker test profile is used, keep its database/volume/port isolated from development and production services and still use the allowlisted `skillstorm_test` database name.

---

# 4. Running tests

Backend E2E:

```bash
cd server
npm run test:e2e
```

Full-stack Playwright uses the current Playwright/server scripts. Inspect the active `package.json` and Playwright config before changing startup commands; executable configuration has precedence over this runbook.

Any runner that performs reset/cleanup must fail closed if the database-safety guard cannot prove the target is allowed.

---

# 5. CI contract

CI database services must be disposable and isolated.

Current CI uses the `skillstorm_test` naming convention for destructive application-test databases. Workflow YAML is the source of truth for exact ports, credentials and job-specific environment variables.

Required properties:

```text
[ ] production/development DATABASE_URL is never reused accidentally
[ ] test DB name passes code-level whitelist
[ ] migrations run against disposable DB
[ ] seed/reset runs only after guard
[ ] no job contains real production credentials
[ ] failing safety guard stops the job
```

---

# 6. Regression tests

`server/test/security/db-safety-guard.spec.ts` (or its current successor) must prove at least:

- accepted allowlisted database works;
- ordinary development database is rejected;
- production-looking `_test` name is rejected if not allowlisted;
- missing/malformed URL is rejected;
- environment flags cannot bypass the guard;
- password is redacted from thrown/logged errors.

When test startup/teardown files change, preserve at least one integration-level proof that the guard is actually invoked before destructive operations.

---

# 7. Restore is a separate domain

A production recovery is not a test reset.

For backup/restore use:

- [`../ops/backup-restore.md`](../ops/backup-restore.md)
- `scripts/ops/restore-db.sh`
- `scripts/ops/restore-drill.sh`

Do not weaken `db-safety.js` because an operations task needs to target another database.

---

## Final invariant

> **Automated SkillStorm test tooling may destroy only an explicitly allowlisted disposable test database. If the target cannot be proven safe, the operation stops.**