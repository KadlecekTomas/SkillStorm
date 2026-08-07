# SkillStorm CI — workflows, gates and branch protection

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** current GitHub Actions topology, CI invariants and branch-protection guidance  
> **Technical authority:** the workflow YAML files under [`.github/workflows`](../.github/workflows/) are executable truth. If this document diverges, fix the document and workflow intentionally in the same change.

---

## 1. Goal

`main` must not normalize red CI.

A required check is useful only if a failure is treated as actionable. A permanently failing or routinely bypassed gate creates false confidence.

The repository currently has these workflow files:

- `.github/workflows/ci.yml`
- `.github/workflows/e2e-scenarios.yml`
- `.github/workflows/ci-seed-validate.yml`
- `.github/workflows/frontend-ci.yml`
- `.github/workflows/production-gate.yml`

Do not copy workflow/job names from historical documents when configuring branch protection; read the names from the current YAML and the GitHub required-check UI.

---

# 2. Current workflow responsibilities

## `ci.yml` — `SkillStorm CI (Simplified)`

Primary broad application gate.

Current responsibilities include:

- frontend install/build;
- frontend component-policy tests;
- backend dependency install and Prisma client generation;
- migrations against a disposable `skillstorm_test` database;
- backend typecheck/build;
- policy/RBAC tests;
- seed path validation used by this workflow;
- gamification/decorator checks;
- backend onboarding invariant;
- real frontend onboarding invariant.

### Backend lint status

The current workflow executes backend lint as `continue-on-error` while cleanup remains unfinished.

Therefore:

> **backend lint is currently observability, not a merge-blocking quality guarantee.**

Documentation and release notes must not claim otherwise. Turning it into a blocking gate requires a dedicated cleanup/change with a green baseline.

## `e2e-scenarios.yml`

Real-browser + backend Playwright scenarios for the supported deterministic end-to-end flows.

This is the primary browser-level behavioral gate. Historical or quarantined suites do not become required merely because they still exist in the repository.

## `ci-seed-validate.yml`

Validates seed integrity against an isolated test database.

## `frontend-ci.yml`

Frontend quality gate for the checks defined in that workflow, including current lint/typecheck/unit responsibilities.

## `production-gate.yml`

Production-configuration/build gate. It covers the production-oriented checks defined in the current workflow, including backend/frontend build validation, Prisma generation/validation and environment/Docker configuration checks.

---

# 3. Environment invariants in CI

The production server validator currently requires, in production mode, values including:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CORS_ORIGINS
DATABASE_URL
METRICS_INGEST_KEY
PUBLIC_APP_URL
API_URL
```

CI uses synthetic non-production values where secrets are needed to exercise application paths. Production secrets must never be copied into workflow YAML.

### Important distinction

`NODE_ENV=test`, `development` and `production` have different bootstrap behavior.

Tests that need a listening HTTP server must use the mode required by their actual runner contract rather than assuming `NODE_ENV=test` always opens a port.

If bootstrap semantics change, update:

- workflow YAML;
- relevant tests/config;
- this document.

---

# 4. Database isolation

CI jobs must not target developer or production databases.

Current workflows use disposable PostgreSQL services and database names such as:

```text
skillstorm_test
```

The application/test safety layer may impose additional naming restrictions. Those executable safeguards have precedence over prose.

### Required rule

Any CI path that runs migrations, seeds, cleanup or destructive test setup must be demonstrably isolated from production and shared development databases.

---

# 5. Playwright / server startup invariant

Browser tests depend on a live frontend/backend topology.

Key rules:

- database migrations must exist before server code that queries migrated tables starts;
- the server mode used by Playwright must actually listen on the expected port;
- cold-build/runtime behavior on CI must be reflected in the Playwright web-server configuration;
- a timeout with no captured server output is not an acceptable debugging experience — relevant stdout/stderr must be surfaced by the workflow/config.

Do not duplicate fragile startup recipes across many workflow files when one reusable script/config can become the source of truth.

---

# 6. Seed semantics

Different seed commands may have different responsibilities.

Before changing a CI seed step, inspect the current `package.json` script target and seed source file. Do not assume:

```text
prisma:seed == bootstrap seed == demo seed == scenario seed
```

A seed change is production-sensitive when it changes:

- required roles/permissions;
- tenant fixtures;
- onboarding identity;
- content IDs referenced by e2e scenarios;
- immutable/audited records.

Such changes require their dependent tests to be updated in the same PR.

---

# 7. Required-check policy for `main`

Branch protection should require the **current stable merge-blocking jobs** from the workflows above.

Because GitHub required checks are identified by actual check/job names and those can change when YAML is edited, this Markdown intentionally does not freeze a stale numbered list forever.

When workflow names change:

1. merge/update the workflow intentionally;
2. verify the new checks complete on a PR;
3. update branch protection to require the replacement checks before removing old names;
4. update this document if responsibilities changed.

Recommended branch-protection principles:

- require the current CI/application gate;
- require current real-browser scenario gate;
- require seed validation;
- require frontend quality gate;
- require all current production-gate jobs;
- require branches to be up to date when repository policy calls for it;
- do not allow routine bypass of required checks.

---

# 8. Removed / legacy suites

Historical workflows and quarantined suites are evidence of previous testing approaches, not current release gates.

A legacy suite may return to required CI only after:

- its contract matches current APIs/schema;
- it has a deterministic isolated database setup;
- it is stable across repeated runs;
- it adds coverage not already provided more reliably elsewhere;
- the required-check change is intentional and documented.

Never keep a permanently red workflow solely for the appearance of more coverage.

---

# 9. Failure policy

A required CI failure is a blocker until one of the following is proven:

1. a product/code regression is fixed;
2. a test defect is fixed with preserved intended coverage;
3. an infrastructure/transient failure is identified and safely rerun;
4. a gate is intentionally redesigned/removed with explicit rationale and replacement coverage where needed.

`rerun until green` is not a diagnosis for a deterministic failure.

---

# 10. Change checklist

When changing CI:

```text
[ ] workflow YAML inspected on current branch
[ ] environment contract matches server validation
[ ] DB is disposable and isolated
[ ] migrations run before schema-dependent tests
[ ] seed command semantics verified
[ ] browser server startup mode verified
[ ] logs are available on failure
[ ] required-check names/branch protection considered
[ ] docs updated if responsibilities changed
[ ] at least one PR run validates the resulting topology
```

---

## Final invariant

> **SkillStorm CI is a release-control system, not a dashboard decoration. Every required green check must represent a contract we actually trust, and every required red check must stop the merge until its cause is understood.**