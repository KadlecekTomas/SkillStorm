# SkillStorm — ClassParták Rules

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** current class-level companion/progression behavior connected to Live Sessions  
> **Implementation authority:** `server/src/live-sessions/live-sessions.constants.ts`, `server/src/live-sessions/live-sessions.service.ts`, current Prisma schema/migrations and Live Sessions E2E tests.

---

## 0. Product role

ClassParták is a **collective participation companion** for a class.

It is not:

- a pupil ranking;
- a class leaderboard;
- an assessment score;
- a mastery metric;
- a reward for correct answers;
- a commercial currency.

Its purpose is to give a shared classroom ritual and visible sense of participation without turning learning performance into public competition.

---

# 1. Current XP contract

The current implementation awards class-level XP only for participation events in Live Sessions.

Current constants:

```text
played round       -> +10 XP
finished session   -> +50 XP
```

Current stage calculation:

```text
stage = 1 + floor(max(0, xp) / 300)
```

These numbers are implementation constants, not curriculum/assessment standards. If the constants change, code/tests and this contract must be updated together.

### Non-negotiable invariant

Correctness does not enter the XP calculation.

The following must **not** change ClassParták XP:

- `MOSTLY_CORRECT` vs `SPLIT` vs `MOSTLY_WRONG`;
- vote distribution;
- number of wrong attempts in an interactive round;
- teacher outcome override;
- individual pupil score.

Two classes that complete the same participation path receive the same ClassParták XP even when their answer correctness differs.

---

# 2. Why correctness is excluded

A whole-class shared board is a teaching context. Publicly rewarding a class more for correctness can create several bad incentives:

- pressure on weaker pupils;
- public performance comparison;
- reluctance to attempt difficult questions;
- optimization for easy content to gain rewards;
- confusion between engagement and learning evidence.

Therefore:

> **ClassParták rewards participation in the learning ritual, while learning evidence and assessment remain separate data domains.**

---

# 3. Privacy and visibility

Current ClassParták data is class-level.

It must not be used to expose:

- which pupil caused a wrong class answer;
- per-pupil contribution to class XP;
- pupil-level ranking;
- comparative ranking of classes based on correctness;
- individual mastery inferred from class progress.

A future pupil-owned companion/album is a separate product feature and requires its own privacy/accessibility/content contract before implementation.

---

# 4. Event/idempotency contract

ClassParták XP must be idempotent for one logical source event.

The persistence layer uses dedicated XP-event/provenance records so a retry, refresh or repeated service call does not award the same event twice.

Required invariant:

```text
same logical source event
→ at most one XP award
```

Examples that must not double-award:

- repeated finish request for one Live Session;
- concurrent completion path;
- replay/retry of the same round-derived award;
- reconstructing an already-finished session after refresh.

A new XP source requires a stable source identity and an idempotency test.

---

# 5. Campaign boundary

Campaigns may react to participation/session progression according to the current campaigns contract.

Campaign advancement must not secretly turn correctness into ClassParták XP.

Keep the domains separate:

```text
Live Session outcome
→ teacher/class reflection

Live Session participation
→ ClassParták XP

Campaign rules
→ campaign progression/unlocks according to campaign contract
```

Any future cross-domain reward requires explicit review for gaming incentives, pupil comparison and data semantics.

---

# 6. Age/presentation modes

Live Sessions can vary presentation by age mode (`YOUNG`, `MIDDLE`, `SENIOR`).

Changing presentation may change:

- illustration style;
- density;
- wording/tone;
- animation intensity.

It must not change:

- earned XP for the same logical participation event;
- curriculum evidence meaning;
- permissions;
- pupil privacy.

---

# 7. No monetized progression

Current and future SkillStorm commercial features must preserve:

```text
money cannot buy XP
money cannot buy stage
money cannot improve learning score/mastery
money cannot create a competitive advantage
```

Physical/cosmetic merchandise, if ever introduced, is outside the current implemented contract and must be sold only through a separately reviewed adult-facing commerce flow.

A future roadmap document cannot weaken this invariant without an explicit product/safety decision and corresponding contract change.

---

# 8. No public ranking

SkillStorm must not introduce a default leaderboard such as:

```text
1. 7.A — 3 200 XP
2. 7.B — 2 800 XP
3. 7.C — 2 100 XP
```

for ClassParták.

A class can see its own shared progression where the current UI permits it. Cross-class comparative ranking is a separate consequential product decision and is prohibited by this current contract.

---

# 9. New reward-source gate

Before adding a new source of ClassParták XP, the PR must answer:

```text
What exact participation behavior is rewarded?
Why is it appropriate to reward collectively?
Can the event be replayed/retried?
What is the stable idempotency key?
Does correctness/performance affect the amount?  -> must be NO under current contract
Can a pupil be singled out from the event?        -> must be NO for class XP
Can money influence the event/reward?             -> must be NO
Which E2E/unit test proves no duplicate award?
Which test proves correctness independence?
```

No answers = no new XP source.

---

# 10. Required regression tests

At minimum preserve tests that prove:

```text
[ ] played round awards the current participation XP exactly once
[ ] finished session awards the current participation XP exactly once
[ ] duplicate/retried finish does not double-award
[ ] opposite correctness distributions produce equal participation XP
[ ] teacher outcome override does not alter participation XP
[ ] invalid/cross-tenant actor cannot mutate another class's progression
[ ] stage calculation is deterministic for boundary values
[ ] negative XP/state cannot create an invalid stage
```

If a future feature adds pupil-owned collectibles, its tests must be separate from class-level XP tests.

---

# 11. Boundary with Parťák 2.0 vision

[`roadmap/partak-2.0.md`](./roadmap/partak-2.0.md) is a future product concept, not current behavior.

Potential future ideas such as:

- pupil-selected companions;
- evolution artwork;
- private albums;
- physical merchandise;

may be explored only after pilot validation and must not be inferred to already exist from this contract.

Where that vision conflicts with this current rules document, **this current contract wins until an explicit roadmap/contract migration is approved and implemented**.

---

## Final invariant

> **ClassParták rewards shared participation, never correctness, status or spending. It remains idempotent, class-level and non-comparative, while assessment/mastery data stays in separate evidence domains.**