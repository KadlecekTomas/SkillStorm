# SkillStorm — Bleskovky (Live Sessions)

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** current Live Sessions / Bleskovky implementation, primarily `BOARD_ONLY`; explicit seams for future `DEVICES` mode  
> **Implementation authority:** current Prisma schema, `server/src/live-sessions/`, relevant controllers/DTOs and client Live Session components. Future Interactive Curriculum work must also obey [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md).

---

## 0. Current implementation boundary

Bleskovky are live whole-class exercises for an interactive board.

The current implemented product is primarily **mode B — `BOARD_ONLY`**:

- the teacher controls the session from the shared display;
- pupils answer aloud / collectively;
- optional board voting stores only anonymous aggregates;
- the teacher records or confirms the round result.

The data model contains seams for a future **mode A — `DEVICES`**, where pupils would join with their own devices and realtime transport. `DEVICES` is **not declared implemented by this document**.

Interactive board rounds (`MATCH_PAIRS`, `ORDER`, `SORT_BINS`) are documented in [`live-sessions-interactions.md`](./live-sessions-interactions.md).

### Architecture boundary

Current Bleskovky can use an existing `Test`/`Question` set as source content. This is a compatibility choice for the implemented feature, **not** a rule that future simulations, Chem Lab, Map Lab, Audio Lab or Build-a-PC must be modeled as tests/questions. The future Activity/Lesson Experience layer is defined separately by the Interactive Curriculum contracts.

---

# 1. Current data model

- `LiveSession` — one Bleskovka run: teacher/host membership, organization, optional class section, source test, mode/status, age mode and countdown configuration.
- `LiveSessionRound` — one round with a **snapshot** of the source question. Later source-test edits do not retroactively change an active/finished session.
- `LiveSessionParticipant` — model seam for future participant/device workflows; current `BOARD_ONLY` behavior must not create per-pupil participation records merely to represent shared-board use.
- `ClassPartak` + `ClassPartakXpEvent` — collective class companion/progression records.

Exact field names and relations are defined by the current Prisma schema.

## Source set = `Test`

For the current quiz path, a Bleskovka source set is a published `Test`. Only compatible questions are snapshotted into quiz rounds. Current compatibility includes single-answer multiple-choice and true/false paths; unsupported classic test formats are not silently converted.

Interactive-only question types have their own publish/assignability contract described in the interaction document.

---

# 2. Session state machine

Current high-level state:

```text
DRAFT --start--> RUNNING --finish--> FINISHED
```

Important implementation invariants:

- `start` creates round snapshots transactionally and guards against duplicate concurrent transition;
- `finish` is atomic/idempotency-aware according to the current service contract;
- repeated invalid state transitions fail explicitly rather than silently mutating history.

---

# 3. Quiz round flow

Voting is optional:

```text
QUESTION --start voting--> VOTING --reveal--> REVEAL
    \---------------------------------------> REVEAL
              skip voting / teacher reveal
```

Current behavior:

- voting can be opened only for a valid active round;
- votes are anonymous aggregate deltas by answer key;
- aggregate counts cannot be driven below zero;
- votes are accepted only during the voting phase;
- reveal persists the reveal boundary and may derive a suggested aggregate outcome;
- teacher may override the suggested aggregate outcome through the current outcome flow.

Current aggregate outcome thresholds are implementation constants. Code/tests have precedence over prose if the threshold values change.

### XP invariant

Anonymous voting distribution and correctness must not alter ClassParták XP. XP represents participation/played-session mechanics according to the current ClassParták contract, not public class performance ranking.

---

# 4. Solution-secrecy contract

**Correct answers/solutions must not leave the server before the reveal boundary.**

For quiz rounds:

- pre-reveal session projection excludes `correctKeySnapshot`;
- reveal can return/persist the correct key;
- after reveal, refresh may include already-revealed solution data so the board can reconstruct the current state.

This is a security/product invariant for a shared display: network inspection on the classroom device must not expose answers for unrevealed rounds.

Any future WebSocket/device implementation must preserve the same semantic boundary: question/event before reveal contains no solution; reveal is a separate authorized event.

---

# 5. Authorization and tenant isolation

Current Bleskovka endpoints are teacher-authorized through the existing RBAC model and include host/session ownership constraints.

Required behavior:

- cross-organization access must not reveal resource existence;
- another teacher in the same organization must not gain host control unless explicitly allowed by a future reviewed capability;
- client-side route hiding is never authorization;
- session, class and source-test organization relationships must be checked server-side.

Current board projection is teacher-authenticated. There is no public pupil URL required for the implemented `BOARD_ONLY` flow.

---

# 6. Privacy contract for `BOARD_ONLY`

`BOARD_ONLY` is intentionally class-aggregate rather than pupil-tracking.

Current shared-board voting stores only anonymous aggregate counts such as:

```json
{"A":14,"B":6}
```

The implemented `BOARD_ONLY` path must not create:

- per-pupil answers;
- pupil identity linkage for board votes;
- pupil performance ranking;
- hidden individual behavior profiles from shared-board interaction.

`LiveSessionParticipant` existing in the schema does not authorize writing pupil records in `BOARD_ONLY`.

If future `DEVICES` participation is implemented, its identity, nickname, retention and evidence behavior requires an explicit privacy/security review under the Interactive Curriculum Production Contract.

---

# 7. ClassParták invariant

The current ClassParták path rewards **participation**, not correctness.

Current conceptual sources include:

- played round;
- finished session.

The exact XP constants/stage formula are implementation details defined in current code/tests. Do not use them as pedagogical achievement scores.

### No class ranking

The product must not expose public or director-facing class league tables based on Bleskovka/ClassParták performance merely because aggregate data exists.

---

# 8. Age modes

Current Live Sessions support age/presentation modes including:

```text
YOUNG
MIDDLE
SENIOR
```

They change presentation density/tone and classroom pacing defaults; they must not silently change curriculum claims, stored evidence meaning or authorization.

The initial mode can be derived from class grade and teacher-overridden where the current UI permits. Unknown/unsupported contexts must use the implementation's explicit safe fallback rather than an accidental enum/string default.

---

# 9. Future `DEVICES` seams — not implemented capability

Existing architecture intentionally leaves expansion points for:

1. participant records / join-reconnect behavior;
2. lobby between creation and start;
3. realtime round-open/reveal/close events;
4. per-participant semantic responses;
5. explicit `DEVICES` mode orchestration.

These are **future seams, not current promises**.

When implemented, they must satisfy the newer Interactive Curriculum contracts for:

- semantic events and idempotency;
- reconnect/resume;
- tenant/RBAC enforcement;
- minimal learner telemetry;
- evidence semantics;
- privacy/retention;
- board/public projection safety;
- accessibility.

Do not bolt pupil WebSockets directly onto the old board flow without that review.

---

# 10. Current non-goals for `BOARD_ONLY`

The implemented board mode intentionally has no requirement for:

- pupil join codes;
- per-pupil websocket clients;
- per-pupil answer history;
- public ranking/leaderboards;
- individual mastery claims from anonymous class votes.

Adding any of these is a product/data-contract change, not a cosmetic enhancement.

---

# 11. Seed/demo content

The repository may contain Live Sessions seed/demo sets for development and scenarios.

Seed content is **test/demo data**. It does not by itself establish curriculum alignment or production content quality. Curriculum claims require the review/mapping gates in the Interactive Curriculum contracts.

Always inspect the current seed scripts/package scripts before relying on a specific demo command or fixed content set; executable scripts are authoritative over this prose.

---

# 12. Regression gate

Changes to current Bleskovky must preserve tests for at least the affected invariants:

```text
[ ] tenant isolation / host authorization
[ ] legal state transitions
[ ] start/finish concurrency and idempotency
[ ] pre-reveal solution secrecy
[ ] reveal reconstruction after refresh
[ ] voting accepted only in voting phase
[ ] vote aggregate cannot go negative
[ ] opposite correctness distributions do not change participation XP
[ ] BOARD_ONLY creates no per-pupil response record
[ ] interactive-round compatibility remains consistent with publish/assignability rules
[ ] real-browser board flow remains usable on touch-sized targets
```

---

## Final invariant

> **Current Bleskovky are a safe shared-board classroom feature: teacher-controlled, tenant-scoped, solution-safe before reveal and aggregate-only for pupils. Future device participation must extend this contract deliberately; it must not be inferred from dormant schema fields or enum values.**