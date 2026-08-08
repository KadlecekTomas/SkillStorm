# SkillStorm — Campaigns Architecture Decision Record

> **Status:** `HISTORICAL / ADR`  
> **Owner:** Engineering + Product  
> **Decision period:** July 2026  
> **Last reviewed:** 2026-08-07  
> **Current contract:** [`campaigns.md`](./campaigns.md)  
> **Authority rule:** this file preserves why the first campaign implementation was shaped as it was. It is not an active backlog, bug list or higher-precedence specification.

---

## Purpose

The original implementation produced a working overnight decision log containing architectural choices, temporary questions and implementation observations.

Those mixed concerns are separated now:

- **current behavior/invariants** → [`campaigns.md`](./campaigns.md);
- **implementation order** → [`roadmap/master.md`](./roadmap/master.md);
- **open work** → current issues/specs/roadmap, not this file;
- **historical rationale** → this ADR.

Questions that were unresolved in July 2026 must not be treated as current defects or requirements merely because they remain visible in Git history.

---

# ADR-1 — Campaign definitions live in the content registry

### Decision

Campaign definitions are repository content (`server/content/campaigns/*.json`) rather than mutable `Campaign` database rows.

### Rationale

- adding/editing narrative content can be code-reviewed as data;
- startup schema validation catches malformed content;
- no database migration is required merely to add narrative content;
- persistent database tables can focus on runtime state/provenance.

### Consequence

Stable campaign/step identifiers referenced by persisted progress become compatibility-sensitive. Meaning-changing edits require explicit versioning/migration rather than casual reordering/renaming.

---

# ADR-2 — One unlock table represents campaign step history

### Decision

A durable `CampaignStepUnlock`-style record represents one unlocked campaign step rather than adding separate persistence models for each visual collectible type.

### Rationale

The same durable event can be rendered differently according to campaign content:

```text
EXPEDITION -> sticker/stop
MISSION    -> fragment/chapter
```

This keeps the data model focused on provenance and progression rather than presentation assets.

---

# ADR-3 — Participation, not completeness/correctness, advances a campaign

### Decision

A finished linked Live Session advances campaign progress when at least one round was actually played/completed according to the current service contract.

### Rationale

A lesson can end early for legitimate classroom reasons. Requiring every planned round would encourage teachers to rush merely to protect a game mechanic.

Zero-play start/finish must not advance because that would make campaign progression trivially spammable.

Correctness remains irrelevant to campaign progression.

---

# ADR-4 — Progress advancement is idempotent and serialized

### Decision

Campaign advancement is coupled to the Live Session finish transaction and protected by durable uniqueness/serialization mechanisms so one session cannot unlock more than one logical campaign step.

### Rationale

Browser retries, duplicate clicks and concurrent class/session operations are expected operating conditions, not exceptional corruption cases.

The current implementation/tests are authoritative for exact lock and uniqueness mechanics.

---

# ADR-5 — Campaign targeting uses `SchoolGrade`, not presentation age mode

### Decision

Campaign content declares target grades separately from `LiveAgeMode`.

### Rationale

`LiveAgeMode` is a presentation choice; it does not model curriculum/grade suitability. The boundary between primary stages does not align exactly with presentation breakpoints.

---

# ADR-6 — Predecessor message requires explicit teacher reveal

### Decision

A message from a previously completed class/campaign is not automatically pushed to the next class projection.

The receiving teacher must have an authorized preview path and explicitly reveal the message before it can appear on the board.

### Rationale

- avoids surprising/unreviewed user-generated content appearing on a shared classroom display;
- preserves a teacher-controlled reveal boundary similar to solution reveal;
- makes board state reconstructable and intentional.

Any future expansion of cross-class messages requires a renewed moderation/privacy/content-safety review.

---

# Historical implementation observation — deterministic scenario seed cleanup

The initial campaign work exposed that a repeated scenario seed cleanup could fail because Live Session/Campaign-related records still referenced tests.

The seed cleanup order was subsequently expanded to remove dependent campaign/Live Session/ClassParták records before deleting source tests.

This is retained only as historical rationale for dependency-aware deterministic test cleanup. Current seed scripts/tests, not this note, define today's cleanup behavior.

---

# Superseded overnight questions

The original log included temporary questions such as:

- whether campaign copy should use dynamic dates;
- where a campaign projection entry point should appear;
- how multiple homerooms should be surfaced;
- whether completed campaigns should replay for the same class;
- exact timing semantics for predecessor messages;
- whether Expedition should gain a Mission-like epilogue.

These are **not active requirements by virtue of appearing in this ADR**.

If any becomes relevant, it must be reintroduced through a current issue/spec and reconciled with:

- current implementation;
- Master Roadmap priority;
- classroom evidence;
- privacy/security/accessibility contracts.

---

## Final invariant

> **This ADR explains historical choices; it never overrides the current Campaigns contract, executable code/tests or the Master Roadmap.**