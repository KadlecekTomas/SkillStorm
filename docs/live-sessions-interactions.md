# SkillStorm — Bleskovky: Interactive Board Rounds

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** current touch/drag-and-drop interaction types used inside `BOARD_ONLY` Live Sessions  
> **Parent contract:** [`live-sessions.md`](./live-sessions.md)  
> **Implementation authority:** current Prisma schema, shared interactive-content utilities, Live Sessions service/DTOs and board/editor components.

---

## 0. Implemented interaction types

Current Live Sessions support classic quiz rounds plus board-native interactive rounds:

| `RoundInteractionType` | Board interaction | Server judgement |
| --- | --- | --- |
| `QUIZ` | answer tiles / optional voting | reveal/outcome flow |
| `MATCH_PAIRS` | connect/match two sets | each placement validated server-side |
| `ORDER` | arrange cards then check | server returns positional result mask |
| `SORT_BINS` | move cards into bins | each placement validated server-side |

Exact authoring limits and payload shapes are defined by current validators/types in code.

---

# 1. Non-negotiable solution secrecy

The solution must not leave the server before the round's completion/reveal boundary.

Conceptually:

```text
contentSnapshot   -> board-safe shuffled content
solutionSnapshot  -> server-only solution until reveal/completion
```

The shared classroom device must not be able to discover an unrevealed solution through network inspection, serialized props, client source or predictable IDs.

This extends the `correctKeySnapshot` invariant from quiz rounds.

---

# 2. Round-local identifiers

Authoring identifiers must not leak answer order/relationships.

When a round is snapshotted for play, displayed items use round-local IDs after shuffling/re-keying.

Forbidden implementation shortcut:

```text
authoring ID encodes solution position/order
→ same ID is sent to board
→ pupil can infer solution
```

Every new interaction type must review whether IDs, array order, labels or metadata leak the hidden solution.

---

# 3. Snapshot immutability

An active/finished round is evaluated against the immutable snapshot created for that session.

Later edits to the source question/content must not change:

- the board content already shown;
- the solution used for that round;
- the recorded aggregate attempt history;
- the reconstructed state after refresh.

---

# 4. Error-feedback principle

Interactive rounds are iterative learning interactions, not public pupil verdicts.

Current UI intent:

- incorrect placement returns/rejects the item without public humiliation;
- correct placement settles clearly;
- pending server validation is visible without freezing unrelated interaction where the implementation supports concurrency;
- feedback must remain understandable without relying on color alone.

`BOARD_ONLY` stores only anonymous/class-level attempt aggregates. It must not silently attach board mistakes to individual pupils.

---

# 5. Attempt aggregation

Current implementation may maintain aggregate fields such as counts of:

```text
wrong attempts
placed items
whole-round checks
```

These values are class/session interaction telemetry, not pupil records.

They may support aggregate outcome suggestions and teacher reflection. They must not be repurposed into hidden individual grading or ranking.

---

# 6. Network/latency behavior

Board interactions execute over real school networks.

Current design assumes server-authoritative semantic attempts rather than streaming pointer coordinates.

Typical flow:

```text
pupil/teacher drops card
→ client shows PENDING state
→ semantic PLACE/CHECK request
→ server validates
→ client settles or returns item
```

The application should tolerate ordinary latency without:

- duplicate scoring;
- losing accepted placements;
- revealing solution state optimistically;
- blocking the entire board unnecessarily;
- turning transient latency into a false wrong answer.

Idempotency/concurrency behavior belongs in server tests, not only client animation logic.

---

# 7. Aggregate outcome is advisory

Current interactive rounds can derive an aggregate outcome from attempt counts using implementation constants.

The teacher remains able to override that aggregate judgement through the current Live Sessions flow.

Exact thresholds are code-level policy and must be covered by tests. This document deliberately does not duplicate numeric constants that can drift.

### XP invariant

Attempt quality/correctness must not change ClassParták participation XP. A difficult class interaction and a flawless one must not become a public reward/punishment mechanism through hidden XP arithmetic.

---

# 8. Code ownership map

Current responsibilities are distributed approximately as follows.

## Server

- Prisma schema — interaction enum/content/snapshot/attempt fields;
- shared interactive-content validation — authoring payload types and limits;
- assignability/publishability validation — separates Live Session content from classic student-test assignment constraints;
- Live Sessions snapshot/evaluation utilities — safe shuffled board payload + hidden solution;
- Live Sessions service — semantic attempts, aggregate counters, completion/reveal;
- attempt DTOs — trust-boundary validation.

## Client

- touch drag/drop primitives — pointer/touch interaction and drop zones;
- round components/hooks — pending/wrong/settled state;
- Live board — classroom presentation/control integration;
- content editor — authoring experience for implemented interaction types.

Exact file names may evolve; use repository code/search rather than treating this section as a permanent import map.

---

# 9. Publish vs. classic student assignment

Interactive board question/content can be valid for a published Bleskovka source set while being invalid for assignment as a classic individual test.

That distinction is intentional.

Required rule:

```text
publishable for Live Sessions != assignable as classic Test
```

The current validation layer must reject malformed interactive content and prevent interactive-only content from entering a student-test flow that cannot execute/evaluate it correctly.

Do not remove the assignability guard merely to make one UI warning disappear.

---

# 10. Adding a new interaction type

A new interaction type is a vertical contract change, not only a new React component.

Required review checklist:

```text
[ ] schema/enum implications reviewed
[ ] authoring payload schema + limits defined
[ ] DTO/server validation added
[ ] solution-leak analysis completed
[ ] round-local ID/shuffle strategy defined
[ ] snapshot builder added
[ ] semantic attempt/evaluation contract defined
[ ] concurrency/idempotency behavior tested
[ ] client touch + keyboard/non-drag accessibility path considered
[ ] builder/editor support added
[ ] publishability/assignability behavior explicit
[ ] aggregate telemetry/privacy classification explicit
[ ] XP invariant preserved
[ ] server E2E regression coverage added
[ ] real-browser/touch scenario added
```

### Accessibility requirement

Future drag interactions must not assume drag-and-drop is the only way to complete the cognitive task. Where the learning objective does not itself require a physical drag gesture, provide an accessible alternative interaction such as select-target / move controls / keyboard operation.

---

# 11. New Interactive Curriculum boundary

These board rounds are useful reusable primitives, but the future Activity Engine is broader than `Question.content`.

Do not conclude:

```text
MATCH_PAIRS works in Question.content
therefore every simulation belongs in Question.content
```

Complex stateful simulations and subject engines use the Activity/Lesson Experience architecture defined in:

- [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md)
- [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)

Existing Bleskovka interactions can later be reused/adapted through explicit compatibility layers.

---

# 12. Regression gate

At minimum, changes affecting interactive rounds must keep relevant automated coverage for:

```text
[ ] hidden solution absent before reveal/completion
[ ] round-local IDs do not leak solution mapping
[ ] source edits do not mutate existing session snapshots
[ ] invalid authoring content cannot publish
[ ] interactive-only content cannot enter unsupported classic assignments
[ ] PLACE/CHECK validates item/target IDs server-side
[ ] duplicate/concurrent completion cannot double-apply state
[ ] aggregate counters cannot create invalid negative state
[ ] opposite performance quality does not alter participation XP
[ ] cross-tenant/host authorization remains enforced
[ ] touch workflow works in a real browser
[ ] non-color feedback/accessibility remains usable
```

---

## Final invariant

> **Interactive board rounds are server-authoritative, solution-safe, snapshot-based and class-aggregate. A new interaction must preserve those properties before it is considered part of the implemented Live Sessions contract.**