# SkillStorm — Submission Concurrency & Locking Contract

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** concurrency, idempotence and database integrity for the current classic Test/Assignment/Submission flow  
> **Implementation authority:** `server/src/submissions/submissions.service.ts`, current Prisma schema/migrations and the named E2E tests below. If executable behavior changes, update this document in the same PR.

---

## 0. Purpose

A classroom can produce many simultaneous submission requests and one pupil/browser can produce overlapping autosaves or repeated submit clicks.

The required contract is therefore not merely “requests usually work”. The system must preserve:

- one coherent attempt number per pupil/assignment;
- no duplicate response rows caused by races;
- no lost accepted response update;
- no mutation after a submission is closed;
- deterministic double-submit behavior;
- tenant/student ownership checks even inside locked transactions;
- database-level protection for critical invariants.

This document describes the **currently implemented classic submission path**. It is not the concurrency model for future Activity/LiveSession semantic events; those use their own idempotency/versioning contract under the Interactive Curriculum Production Contract.

---

# 1. Concurrency model by operation

## 1.1 Create attempt — serialize per learner

Current `create()` must prevent two concurrent requests for the same pupil from both observing the same attempt count and creating an invalid duplicate/attempt number.

The implementation serializes the count+create critical section by taking a PostgreSQL row lock on the pupil's active `Membership` row:

```sql
SELECT membership_id
FROM memberships
WHERE membership_id = $1
FOR UPDATE;
```

Inside the same transaction it:

1. counts existing submissions for the scoped assignment + pupil;
2. enforces `maxAttempts`;
3. creates the next `attemptNo`.

The database uniqueness constraint remains a second line of defence. A uniqueness race is handled intentionally; it must not surface as an unexplained 5xx.

### Scope invariant

The request is authorized **before and during** the submission path using the current tenant and learner context. A lock never substitutes for authorization.

---

## 1.2 Autosave / `updateResponses()` — serialize per submission

Current response mutation executes inside a transaction beginning with a row lock on the target submission:

```sql
SELECT submission_id
FROM submissions
WHERE submission_id = $1
FOR UPDATE;
```

Only **after the lock is acquired** does the service re-read the submission using tenant-scoped lookup and evaluate mutable state.

The locked transaction then verifies at least:

- the requester is a `STUDENT` in the active organization context;
- the submission exists in that organization;
- the submission belongs to that student's membership;
- the submission is not already finished;
- incoming question IDs belong to the submission's test;
- each response is created/updated consistently.

### Why the re-read matters

This is the intended pattern:

```text
LOCK
→ RE-READ CURRENT STATE
→ VALIDATE
→ MUTATE
→ COMMIT
```

Not:

```text
READ
→ decide
→ later LOCK
→ mutate based on stale decision
```

The first pattern prevents an autosave request that was queued behind `finish()` from writing based on pre-finish state.

---

## 1.3 Finish — serialize and remain idempotent

`finish()` is designed for realistic double-click/retry behavior.

High-level contract:

- tenant/student ownership is checked;
- a previously finished submission returns the already-finished result rather than creating a second finish;
- the transactional critical section locks the submission row with `FOR UPDATE`;
- state is re-read after lock before final scoring/mutation;
- the closing mutation happens once;
- concurrent autosave/finish ordering cannot permit a response mutation after closure.

### Idempotency invariant

A retry of the same logical finish operation must not:

- create another attempt;
- double-score;
- duplicate derived rewards/events;
- reopen the submission;
- produce divergent stored state.

HTTP response formatting may evolve, but the persisted-state idempotency invariant may not.

---

# 2. Why pessimistic row locking is appropriate here

The current contention unit is deliberately narrow:

```text
create attempt    -> one pupil Membership row
response mutation -> one Submission row
finish            -> one Submission row
```

Thirty pupils working simultaneously normally touch thirty different submission rows. They therefore do not form one classroom-wide database lock.

Pessimistic locking is appropriate for this short critical path because it makes the ordering of overlapping writes explicit and keeps correctness server-side instead of requiring optimistic retry loops in browsers.

### Non-goal

Do not introduce a class-wide/table-wide lock for this workflow.

If profiling later proves the current row-lock strategy materially limits production throughput, redesign it with measured evidence while preserving all invariants in this contract.

---

# 3. Database-level integrity — second line of defence

Application-service checks are not the only protection.

## 3.1 `responses_lock_after_submit`

The current database migration installs a trigger that rejects `INSERT`, `UPDATE` or `DELETE` of response rows belonging to an already-submitted submission.

The application maps the database lock condition to the current submission-locked conflict behavior.

Purpose:

- protect against future code paths that forget the service-level check;
- protect integrity from direct ORM/SQL mutation paths;
- make “responses become immutable after submit” a database invariant.

## 3.2 Enrollment organization consistency

The current database also contains an enrollment organization-consistency guard introduced by migration. Its purpose is to prevent a logically impossible cross-organization enrollment relation even if an application path attempts to construct one.

Exact migration names and trigger definitions are executable implementation details. The migration files and canary E2E tests are authoritative when those names evolve.

---

# 4. Canary / regression tests

## `responses-lock-trigger.e2e-spec.ts`

This test is intended to prove the database guard exists **and behaves correctly**, including direct mutation attempts outside the normal service path.

A migration/restore that silently loses the trigger must fail the gate rather than weaken immutable submitted data.

## `submissions-concurrency-load.e2e-spec.ts`

Current concurrent correctness scenario exercises a classroom-sized burst, including:

- many pupils creating submissions in parallel;
- parallel response updates across pupils;
- overlapping autosaves for the same submission;
- concurrent finish requests;
- repeated finish/idempotence behavior.

The important assertions are correctness assertions such as:

- no lost accepted response;
- no duplicate logical response row;
- no deadlock/5xx caused by expected concurrency;
- all intended submissions reach coherent final state.

### Performance-number rule

Any latency values measured on a developer laptop are **historical observations, not a production SLO**.

Do not copy a local p50/p95 table into release guarantees. Production latency objectives require a separately defined environment, dataset, load model, measurement window and percentile budget.

---

# 5. Tenant and ownership safety during concurrency

Concurrency handling must never weaken authorization.

Required rule for every mutation:

```text
authenticated identity
+ resolved active organization context
+ live Membership / role
+ tenant-scoped resource lookup
+ learner/resource ownership where applicable
+ legal state transition
= mutation allowed
```

A caller who guesses a submission UUID from another tenant must not gain access merely because the lock query itself can physically locate that row.

Therefore a raw `FOR UPDATE` lookup is only synchronization. Authorization happens through the scoped re-read and ownership checks before mutation.

---

# 6. Error semantics

Expected concurrent user behavior should produce deterministic domain responses, not generic server failures.

Examples:

- submission already closed → current submission-locked conflict contract;
- invalid/foreign resource → tenant-safe not-found/forbidden policy as defined by the endpoint security contract;
- invalid question ID → validation/domain error;
- exhausted attempts → controlled domain error;
- duplicate finish → idempotent result, not duplicate work.

PostgreSQL serialization/constraint errors that are expected under the designed race envelope must be translated intentionally where the current service contract requires it.

---

# 7. Transaction boundaries

Keep row locks inside short transactions.

Forbidden inside the locked critical section unless explicitly redesigned:

- remote HTTP calls;
- long AI/model calls;
- file uploads;
- e-mail delivery;
- arbitrary sleeps/retries;
- large unrelated analytics recomputation.

Derived work that can safely happen after commit should not extend the database lock lifetime.

If a future side effect must be exactly-once relative to submission completion, use an explicit durable transactional/outbox/idempotency design rather than keeping an external call inside a database transaction.

---

# 8. Schema/migration change gate

A change touching submissions/responses/attempt uniqueness or locking must review together:

```text
[ ] Prisma model constraints
[ ] SQL migrations/triggers
[ ] create-attempt locking
[ ] response autosave locking
[ ] finish idempotence
[ ] tenant/student ownership checks after lock
[ ] trigger canary test
[ ] same-submission autosave race test
[ ] concurrent finish test
[ ] classroom-sized parallel test
[ ] restore compatibility / migration deployment order
```

A change that removes a trigger or uniqueness constraint requires replacement evidence for the same invariant in the same PR.

---

# 9. Boundary with the future Activity Engine

Classic `Submission` is optimized for `Test`/`Assignment` answering.

Future interactive activities use semantic domain events/checkpoints and may need:

- client event IDs;
- duplicate-event suppression;
- monotonic participant/session state versions;
- reconnect/resume cursors;
- snapshot/event projection rebuilding.

Do **not** force those event semantics into `Response` merely because this locking model is already implemented.

The shared principle is the same — deterministic, idempotent state transitions — but the persistence model is intentionally separate.

---

# 10. Definition of Done for submission concurrency changes

A change is ready only when:

- the relevant lock is scoped to the narrowest stable entity;
- state is re-read after lock before the decision that depends on it;
- authorization is revalidated through tenant-scoped state, not inferred from the lock;
- no expected retry/double-click can duplicate persisted effects;
- finished responses remain immutable at service and database level;
- concurrency tests assert database ground truth, not only HTTP success codes;
- no local benchmark is presented as a production performance guarantee;
- all relevant E2E tests are green on the migrated database.

---

## Final invariant

> **SkillStorm may process many pupils in parallel, but overlapping writes to one learner/submission are serialized around a short, tenant-safe critical section, and a completed submission is immutable and idempotent under retries.**