# SkillStorm — Campaigns (Výprava & Mise)

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Product + Engineering + Content  
> **Last verified:** 2026-08-07  
> **Scope:** campaign meta-layer over current `BOARD_ONLY` Live Sessions  
> **Related contracts:** [`live-sessions.md`](./live-sessions.md) · [`partak-rules.md`](./partak-rules.md)  
> **Implementation authority:** current campaign service/content schema, Prisma models/migrations, Live Sessions integration and E2E/browser scenarios.

---

## 0. Product role

A campaign adds persistent class narrative/progression **around** Bleskovky.

It does not replace or redefine the Live Session engine.

Conceptually:

```text
Campaign content
        ↓
class CampaignProgress
        ↓
Live Session is linked to progress
        ↓
finished played session unlocks one campaign step
```

The core Live Session state machine, solution secrecy and ClassParták XP rules remain independent.

---

# 1. Non-negotiable campaign invariants

Current campaign behavior must preserve:

```text
[ ] progress is earned by participation, not correctness
[ ] a session with zero played/completed rounds does not advance campaign progress
[ ] one eligible finished session unlocks at most one campaign step
[ ] duplicate/retried finish cannot double-advance
[ ] correctness/outcome may affect only non-consequential presentation where implemented
[ ] campaign progress does not create a class leaderboard
[ ] unrevealed quiz solutions remain server-side
[ ] predecessor message is hidden until explicit teacher reveal
[ ] tenant/class/teacher authorization is server-side
[ ] campaign content version/drift cannot silently rewrite historical unlock meaning
```

These rules are product + data invariants, not optional UI preferences.

---

# 2. Content architecture

Campaign definitions currently live as versioned repository content under:

```text
server/content/campaigns/*.json
```

The content registry is validated during server startup using the current campaign-content schema.

### Principle

```text
new campaign content
→ reviewed content file
→ validation
→ no new database schema solely for narrative copy
```

Persistent database rows store **runtime/progression state**, not the full mutable campaign copy.

### Stable identity

Campaign IDs and step keys referenced by persisted progress are stable identifiers.

Do not casually rename/remove/reorder identifiers used by already-started campaigns. Any content migration must define how existing `CampaignProgress` / unlock records remain reconstructable.

---

# 3. Runtime data responsibilities

The current implementation includes concepts equivalent to:

## `CampaignProgress`

Persistent class progress for one campaign, including:

- organization/class relation;
- campaign stable ID;
- position/status;
- total-step/type snapshot needed for runtime consistency;
- optional epilogue/predecessor metadata.

## `CampaignStepUnlock`

One durable unlock event for one campaign step/session.

It provides the idempotency/provenance layer for progression and can be interpreted visually as a sticker/fragment according to campaign content.

### Separation rule

A campaign unlock is **class-level campaign state**. It is not an individual pupil assessment record.

---

# 4. Advance transaction

Campaign advancement executes as part of the current Live Session finish flow so that related persistent state remains coherent.

High-level contract:

```text
eligible Live Session finish
→ establish finish is applied once
→ serialize relevant campaign progress
→ verify at least one round was played/completed
→ create one idempotent step unlock
→ advance position/status
→ commit
```

### Concurrency invariant

Concurrent/retried finishes must not:

- skip a campaign position unexpectedly;
- unlock the same step twice;
- attach one session to multiple unlocks;
- double-award ClassParták participation XP.

The exact lock/constraint implementation belongs to current code/migrations; regression tests must prove the invariant.

---

# 5. Correctness independence

Campaign progression does not use `MOSTLY_CORRECT`, `SPLIT`, `MOSTLY_WRONG`, vote share or wrong-attempt count as a gate or multiplier.

Required equivalence:

```text
same legitimate participation path
+ different correctness outcome
→ same campaign progression
```

Presentation may react cosmetically where current UX does so, provided that reaction does not become grading, XP, unlock probability or status comparison.

---

# 6. Predecessor message reveal

A completed Mission can support a message intended for a later class according to current campaign content/policy.

Safety contract:

1. receiving campaign progress references an eligible predecessor according to current service policy;
2. teacher can preview through an authorized teacher-only path;
3. board/class projection does not receive the message before reveal;
4. teacher explicitly reveals it;
5. reveal is persisted/idempotent;
6. refresh after reveal reconstructs the revealed state.

### Content safety

A pupil/class-authored or teacher-entered message displayed to a later class is user-generated school content. Before broad production use, moderation/reporting/retention expectations must remain appropriate to the exact authoring flow and age group.

Do not expose an unreviewed cross-class public feed.

---

# 7. Authorization and tenant isolation

Campaign operations are tenant-owned.

Current server policy requires appropriate teacher-level authorization and additionally scopes class/progress resources to the active organization and the actor's permitted class relation according to current implementation.

Expected security outcomes:

- foreign class/progress ID does not expose another organization;
- student cannot call teacher campaign administration endpoints;
- ordinary teacher cannot control an unrelated class where current policy requires a teaching/homeroom relation;
- director/owner access follows current organization-role policy;
- campaign ID from repository content never grants access to a foreign class progress record.

New campaign endpoints require two-tenant negative E2E coverage.

---

# 8. Current campaign types

Current content supports campaign families including:

```text
EXPEDITION
MISSION
```

Their narrative/presentation differs, while participation and security invariants remain shared.

### `EXPEDITION`

Typical representation:

- route/map;
- stops;
- class collectible/sticker presentation.

### `MISSION`

Typical representation:

- chapters/fragments;
- signal/progress presentation;
- optional epilogue/predecessor-message narrative.

Campaign type is content/presentation semantics, not a different authorization model.

---

# 9. Grade targeting

Campaign availability is based on the actual class grade / `SchoolGrade` targeting declared by content.

Do not use Live Session presentation age mode as a substitute for curriculum/grade targeting.

These are separate dimensions:

```text
SchoolGrade target
→ content suitability/discovery

LiveAgeMode
→ presentation treatment
```

---

# 10. Adding or editing campaign content

Before adding a campaign JSON:

```text
[ ] stable lowercase/approved ID chosen
[ ] schema/version valid
[ ] campaign type valid
[ ] target grades intentional
[ ] every step key stable and unique
[ ] narrative copy age-appropriate
[ ] assets/licensing/provenance approved
[ ] no reward tied to correctness/comparison
[ ] review status is not falsely marked approved
[ ] content validator passes at development/production boot path
[ ] at least one representative test/scenario covers the content family
```

### Editing live content

For a campaign already referenced by persisted progress:

- avoid semantic mutation of stable IDs/step keys;
- prefer a new content version for meaning-changing edits;
- preserve enough snapshot/provenance to render historical unlocks safely;
- do not silently reinterpret a finished class campaign using new copy/ordering where that changes historical meaning.

---

# 11. Curriculum boundary

Campaigns are an engagement/orchestration layer.

A campaign does **not** become curriculum-aligned merely because a Bleskovka inside it is educational.

Future curriculum-aware campaigns must resolve alignment through versioned Lesson Experiences / outcome mappings defined by:

- [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md)
- [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)

Campaign progression itself is not learner mastery evidence.

---

# 12. Current test contract

Current regression coverage includes backend campaign E2E and real-browser scenario coverage.

Preserve/add executable tests for affected invariants, including:

```text
[ ] content registry validates/fails safely
[ ] grade targeting is deterministic
[ ] eligible finish advances exactly once
[ ] zero-play finish does not advance
[ ] duplicate finish does not double-advance
[ ] opposite correctness outcomes advance identically
[ ] campaign/session relation is tenant-safe
[ ] ordinary student is denied campaign administration
[ ] unrelated/foreign teacher/class is denied/masked
[ ] predecessor message is absent before reveal
[ ] teacher preview does not itself reveal
[ ] explicit reveal is idempotent and survives refresh
[ ] ClassParták XP remains participation-only
```

Do not rely on stale fixed test counts in Markdown; the executable suites are the source of truth.

---

# 13. Decision-log status

Historical implementation decisions are retained in [`campaigns-decisions.md`](./campaigns-decisions.md) as an ADR-style record.

That file may explain why a design was chosen, but **this current contract + executable implementation** determine present behavior.

Open questions from an old overnight log are not an active production backlog unless promoted into the Master Roadmap or an issue/spec.

---

## Final invariant

> **Campaigns add class narrative and continuity without altering the fundamental safety model: progression is participation-based, idempotent and tenant-scoped; correctness, ranking and curriculum mastery remain separate concerns.**