# SkillStorm — Tenant Isolation & RBAC Negative-Test Contract

> **Status:** `CURRENT / NORMATIVE SECURITY CONTRACT`  
> **Owner:** Engineering + Security  
> **Last verified:** 2026-08-07  
> **Scope:** negative authorization and tenant-isolation guarantees for the current multi-tenant school platform  
> **Executable evidence:** current backend E2E/unit/policy tests. A row is not considered covered merely because a document says so.

---

## 0. Purpose

SkillStorm stores data for multiple organizations in one application. A valid authenticated user therefore must still be unable to read or mutate another organization's data by:

- guessing a UUID;
- changing a request-body `organizationId`;
- changing a query/filter/year/class ID;
- reusing a resource ID from another tenant;
- holding a valid role in a different organization;
- exploiting a permissive `UserPermission`/role combination;
- reaching an internal/admin-looking route directly.

This document is a **security test contract**, not a historical checklist.

If a required case below lacks executable evidence, the correct state is `REQUIRED BEFORE SCHOOL PRODUCTION`, never an undocumented assumption.

---

# 1. Authorization model under test

For organization-owned operations, authorization is conceptually:

```text
authenticated User
+ active/live Membership in resolved organization
+ OrganizationRole / effective permission
+ tenant-scoped resource lookup
+ resource-specific ownership/class/student relation where required
+ valid resource state
= access allowed
```

Client-side navigation, hidden buttons, submitted `organizationId`, e-mail domain or possession of a UUID are never authorization inputs by themselves.

### Parent/guardian rule

`PARENT` access is relation-scoped. A parent role or user-specific permission must not expand access beyond explicitly linked learner relations.

### Platform roles

`SUPERADMIN`, `SUPPORT` and any future platform role require explicit allow/deny behavior. They are not implicitly exempt from tenant/privacy rules merely because they are system roles.

---

# 2. Status-code policy

The security property matters more than one universal status code, but behavior must be deliberate and stable.

Preferred policy:

- **`404 Not Found`** for cross-tenant object lookup when confirming existence would create an ID/existence oracle;
- **`403 Forbidden`** when the resource is in the actor's resolved tenant but the actor lacks role/permission/ownership;
- **`400 Bad Request`** only for genuinely invalid input/context such as a rejected foreign academic-year selector where that endpoint contract intentionally validates context before object lookup.

Legacy endpoints may currently use `403` or `404` differently. Tests may accept the documented endpoint contract, but new code should not introduce accidental existence leaks.

### Prohibited behavior

Cross-tenant requests must never return:

- `200/201` with foreign data;
- a successful write to the foreign tenant;
- a response body containing foreign PII/content as part of an error;
- a generic `500` caused by an expected authorization scenario.

---

# 3. Test layers

## Primary: backend HTTP E2E

Use Jest + Supertest against the real Nest application and migrated isolated PostgreSQL database for tenant/RBAC boundaries.

Why:

- exercises authentication context;
- guards/interceptors/DTO validation;
- service query scoping;
- database constraints;
- real response status/body behavior.

## Secondary

- unit tests for pure RBAC resolvers and security helpers;
- database/invariant tests for constraints/triggers;
- Vitest policy/component tests for client policy display;
- Playwright for user-visible flows.

A frontend test cannot replace a missing backend tenant-isolation test.

---

# 4. Core P0 security matrix

`VERIFIED` below means executable evidence was located on the current branch during the 2026-08-07 review. `REQUIRED` means it remains part of the production gate and needs explicit backend evidence before a school production release if no equivalent test exists by release time.

| Domain / negative scenario | Required invariant | Current evidence | Gate |
| --- | --- | --- | --- |
| Test read — teacher in Org A uses Org B test ID | no foreign test data | `tenant-scope-fortress.e2e-spec.ts`, `multi-org-security.e2e-spec.ts` | `VERIFIED` |
| Test update — teacher in Org A patches Org B test | no foreign mutation | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Test delete/assign — actor targets Org B test/class | no foreign mutation or existence leak | `multi-org-security.e2e-spec.ts` | `VERIFIED` |
| Create-test body spoof — Org A actor submits Org B `organizationId` | server resolves/scopes to authorized org; body cannot choose tenant | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Class mutation — Org A director targets Org B class | no foreign mutation | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Classroom analytics/risk view — Org A teacher targets Org B class | no foreign data | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Student detail read — Org A director targets Org B student | no foreign PII | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Student mutation — Org A actor patches Org B student | no foreign mutation | no equivalent current-branch backend E2E located in this review | `REQUIRED BEFORE SCHOOL PRODUCTION` |
| Assignment create — Org A teacher uses Org B class | no cross-tenant assignment | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Assignment detail — Org A student uses Org B assignment ID | no foreign assignment data | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Assignment mutation — Org A actor targets Org B assignment | no foreign mutation | `multi-org-security.e2e-spec.ts` | `VERIFIED` |
| Submission detail/list — pupil A attempts another pupil/tenant submission | no foreign learner data | `tenant-scope-fortress.e2e-spec.ts`, `submissions-student-isolation.e2e-spec.ts` | `VERIFIED` |
| Submission creation — Org A pupil uses Org B assignment | no foreign submission | `submissions-student-isolation.e2e-spec.ts` | `VERIFIED` |
| Submission response mutation — pupil attempts another pupil/tenant submission | no foreign response mutation | no explicit current-branch E2E located in this review | `REQUIRED BEFORE SCHOOL PRODUCTION` |
| Submission finish — pupil attempts another pupil/tenant submission | no foreign finish/scoring | no explicit current-branch E2E located in this review | `REQUIRED BEFORE SCHOOL PRODUCTION` |
| Enrollment uniqueness/integrity | one legal enrollment relation per invariant; DB consistency retained | `enrollments-integrity.e2e-spec.ts`, DB consistency canary coverage | `VERIFIED FOR INTEGRITY` |
| Enrollment cross-tenant create/transfer | Org A actor cannot combine Org B student/class/year | no explicit endpoint-level cross-tenant mutation E2E located in this review | `REQUIRED BEFORE SCHOOL PRODUCTION` |
| Analytics year spoof | foreign year/context cannot expose Org B analytics | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Teacher with denied org permission | denied even inside own tenant | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Student calls teacher/admin endpoints | denied | `tenant-scope-fortress.e2e-spec.ts` | `VERIFIED` |
| Parent/guardian relation scope | no access outside linked learner relation; no `UserPermission` bypass | guardian hardening/relation E2E suites | `VERIFIED / keep as release gate` |

### Interpretation

`REQUIRED BEFORE SCHOOL PRODUCTION` is not permission to ignore a gap. It is an explicit release blocker for the current platform before a real school production rollout.

It does **not** block isolated development of the new Interactive Curriculum foundation as long as new work preserves tenant safety and adds its own required tests.

---

# 5. P1 breadth matrix

These areas also require negative coverage before the corresponding capability is released broadly:

| Area | Required tests |
| --- | --- |
| Organization administration | cross-tenant read/update, role boundary, owner/director semantics |
| Student import | foreign class/year spoof, malicious IDs in rows, no partial cross-tenant writes |
| Student export | no foreign rows/columns/attachments; permission denial; filters cannot widen tenant scope |
| Audit log | organization scope, support/platform access policy, PII redaction |
| Support tooling | explicit platform-role policy; no unrestricted tenant browsing by default |
| Subscription/billing administration | organization ownership and platform-role boundaries |
| Curriculum/ŠVP | every school-owned curriculum/version/mapping endpoint rejects foreign IDs |
| Activity/Live Session | session host/teacher/student joins are tenant scoped; join code cannot bridge organizations |
| Learning evidence | pupil evidence accessible only to authorized learner/teacher/guardian scope |
| File/material access | signed/private file access cannot bypass material/organization authorization |

A P1 label means breadth/rollout priority, not that a data leak is acceptable.

---

# 6. New Interactive Curriculum security matrix

Every new curriculum/activity domain introduced under PRD/roadmap work must add negative tests during implementation.

Minimum matrix:

## Curriculum

```text
Org A cannot read/update/delete Org B SchoolCurriculum
Org A cannot publish Org B SchoolCurriculumVersion
Org A cannot bind Org B class/year to a framework applicability row
Org A cannot approve/reject Org B curriculum mapping
foreign curriculum IDs in nested DTOs are rejected/masked
```

## Lesson Experience / content

```text
organization-local content stays inside tenant
GLOBAL content is read-only to ordinary school actors
SHARED content follows explicit sharing policy, never UUID possession
teacher cannot publish centrally governed content
```

## Live Activity session

```text
host belongs to session organization
class belongs to session organization
participant belongs/is admitted to same organization according to join policy
foreign session ID/join code cannot expose roster or telemetry
board projection exposes only approved anonymous/public fields
semantic events cannot name another participant/session/tenant
```

## Evidence

```text
student sees only own evidence where permitted
teacher sees only authorized class/student scope
parent sees only linked child scope
foreign evidence ID is masked/denied
aggregate analytics cannot be used to reconstruct unauthorized individual data
```

These become release-blocking tests for the new domain, not optional follow-up work.

---

# 7. Query-scoping rules

Preferred implementation shape:

```text
resolve authenticated organization context
→ query by (resourceId + organizationId) or tenant relation
→ then apply role/ownership rules
```

Avoid:

```text
findUnique(id)
→ serialize/include foreign relations
→ only later notice organization mismatch
```

Where a lock requires raw ID access for synchronization, as in submission concurrency, the subsequent authoritative read must still be tenant-scoped before mutation.

### Nested IDs

Top-level scoping is insufficient when DTOs reference related entities.

Example create/update must verify all supplied IDs belong to the same authorized tenant:

```text
classSectionId
studentId
teacherId
subjectId
academicYearId
assignmentId
curriculumVersionId
schoolOutcomeId
activity/sessionId
```

Database constraints should enforce high-value consistency relations where practical.

---

# 8. Permission-denial precedence

Explicit deny behavior and security invariants must not be bypassable by a broader user override.

For sensitive roles such as `PARENT`, effective-permission resolution must preserve role invariants defined by the current RBAC implementation/security tests.

Required regression categories:

```text
role allowed + user deny -> denied where policy defines explicit deny precedence
role denied + unsafe user allow -> still denied where role invariant forbids capability
organization-specific permission cannot grant access in another organization
platform role does not inherit organization role implicitly
```

The exact resolver algorithm is implementation authority; the security outcome above is normative.

---

# 9. Soft-delete / inactive-state matrix

Tenant-safe lookup also includes lifecycle state.

Test relevant mutations against:

- soft-deleted User/Membership;
- inactive/suspended User;
- deleted Student/Teacher;
- archived/deleted content;
- closed/expired assignment;
- finished submission;
- archived curriculum/content version.

A valid historical record must not automatically remain mutable because its UUID still exists.

---

# 10. Test fixture rules

A useful tenant security E2E must contain at least two genuinely distinct organizations with distinct resources.

Good fixture:

```text
Org A
  TeacherA
  StudentA
  ClassA
  TestA
  AssignmentA

Org B
  TeacherB
  StudentB
  ClassB
  TestB
  AssignmentB
```

The negative request uses a real authenticated actor from A and a real resource from B.

Do not fake tenant safety by testing only random/nonexistent UUIDs. A `404` for an ID that never existed proves almost nothing about cross-tenant isolation.

---

# 11. Data-leak assertions

A denied status alone is not always sufficient.

For sensitive endpoints also assert response/log side channels do not contain foreign:

- names/e-mails;
- class labels;
- organization names;
- answer content/results;
- file URLs;
- curriculum text created by another tenant;
- internal metadata that confirms existence where the policy masks it.

For list/export/search endpoints assert **absence of foreign rows**, not just status code.

---

# 12. Production release gate for schools

Before a school production rollout, security review must be able to demonstrate:

```text
[ ] every P0 row is VERIFIED by executable current-branch test evidence
[ ] no required test lives only in e2e-legacy/quarantine
[ ] cross-tenant mutation tests exist for students, enrollments and submissions
[ ] parent/guardian relation invariant remains green
[ ] explicit permission-denial tests remain green
[ ] import/export tenant tests cover foreign-ID/filter attempts
[ ] new curriculum/activity/evidence endpoints have two-tenant negative E2E
[ ] DB tenant-consistency canaries are green after migrations/restore
[ ] no release-blocking tenant suite is skipped/continue-on-error
[ ] production CI runs the selected security gates against a migrated isolated DB
```

If any item is missing, the production release is not authorized by this contract.

---

# 13. Change-control checklist

Any new organization-owned resource or endpoint must answer in its PR:

```text
Who owns this record?
How is organization context resolved?
Which role/permission is required?
Which nested IDs are tenant validated?
What status masks a foreign existing ID?
Which E2E proves Org A cannot read it?
Which E2E proves Org A cannot mutate it?
What happens when the record/user/membership is soft-deleted?
Does a parent/support/platform role need narrower handling?
Does an export/list/search aggregate create a side-channel?
```

No answer = not ready for merge into a production-capable domain.

---

## Final invariant

> **In SkillStorm, a valid login grants identity, not universal data access. Every organization-owned read and mutation must be proven safe using real two-tenant negative tests, and missing P0 evidence blocks school production rather than being hidden behind a UI or documentation assumption.**