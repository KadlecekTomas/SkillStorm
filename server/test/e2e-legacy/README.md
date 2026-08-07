# SkillStorm — E2E Legacy Quarantine

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** evidence/documentation for intentionally quarantined drifted backend E2E suites  
> **Last reviewed:** 2026-08-07  
> **Current CI authority:** [`../../../docs/ci.md`](../../../docs/ci.md)  
> **Current security-test authority:** [`../../../docs/tenant-rbac-test-matrix.md`](../../../docs/tenant-rbac-test-matrix.md)

---

## Quarantine notice

Files in `server/test/e2e-legacy/` are **not current release evidence** and are not made trustworthy merely by remaining in the repository.

They were quarantined because fixtures, API expectations or security assumptions had drifted from current behavior. Their exact historical inventory and original remediation notes remain available in Git history of this README and the individual test files.

### Non-negotiable rule

> A legacy suite is never cited as proof of current functionality, tenant isolation or production readiness unless it has first been reconciled with current contracts, moved back into the active test topology and is green in the relevant CI gate.

---

## Returning a suite to active coverage

Before promoting any legacy test:

```text
[ ] read current API/schema/migrations
[ ] reconcile fixtures with current tenant + academic-year contracts
[ ] reconcile auth/session behavior with current implementation
[ ] replace stale expected status codes/payloads intentionally
[ ] confirm the test still covers a useful failure mode
[ ] remove assumptions contradicted by current security contracts
[ ] run the suite against the isolated allowlisted test database
[ ] run the wider current E2E gate
[ ] update docs/tenant-rbac-test-matrix.md if security evidence changes
[ ] update docs/ci.md if CI topology changes
```

Do not mechanically edit an old test until it becomes green while preserving obsolete semantics.

---

## What this directory does not mean

The existence of a legacy test does **not** imply:

- the corresponding feature is currently broken;
- the corresponding feature is currently covered;
- its old fixture represents today's valid data model;
- its old cross-tenant expectation is today's security policy;
- its old count/list is a current backlog;
- moving it into the active directory is sufficient for production use.

Use current active tests and contracts to determine present behavior.

> **Archive invariant:** quarantined tests preserve historical intent; current release confidence comes only from current executable gates.