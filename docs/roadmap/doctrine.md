# SkillStorm — Superseded Founding Doctrine

> **Status:** `SUPERSEDED`  
> **Owner:** Product  
> **Last verified:** 2026-08-07  
> **Purpose:** preserve the existence and historical role of the former `Eduto Doctrine` without allowing it to act as a competing source of truth.

---

## This document is not authoritative

The former **Eduto Doctrine** dated **2026-07-21** described an earlier product thesis centered on a `School Intelligence & Workflow Layer` and declared its own precedence over the roadmap.

That precedence is **revoked**.

The old doctrine was useful as a founding research/strategy snapshot, but several parts no longer match the approved SkillStorm product hierarchy, terminology or current documentation governance.

The complete former text remains recoverable from Git history. It is intentionally not duplicated here because leaving a long obsolete strategy document in-place with authoritative-looking language creates an avoidable implementation risk.

---

# Current authority

Start here:

1. [`../README.md`](../README.md) — documentation registry, status and precedence.
2. [`master.md`](./master.md) — single current source of truth for implementation order.
3. [`../interactive-curriculum/PRODUCTION-CONTRACT.md`](../interactive-curriculum/PRODUCTION-CONTRACT.md) — normative production invariants.
4. [`../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) — normative curriculum/versioning/coverage semantics.
5. [`../interactive-curriculum/README.md`](../interactive-curriculum/README.md) — approved Interactive Curriculum product north star.

Security, privacy and tenant-isolation invariants remain higher-order constraints as defined by the documentation registry and current implementation contracts.

---

# What survives from the old doctrine

Several earlier principles remain compatible with SkillStorm and continue **only where they are restated in current authoritative documents**, for example:

- technology must reduce friction or improve pedagogy rather than exist for its own sake;
- teacher judgement remains meaningful and visible;
- AI may assist but must not silently become authority for consequential pedagogical decisions;
- evidence and pilot data should change product decisions when reality disagrees with assumptions;
- workflow/operations capabilities can support the classroom experience without becoming a second competing product identity.

The authoritative wording is always the wording in the current contracts/roadmap, not the historical doctrine.

---

# Historical reference rule

If an issue, PR, prompt or old document says:

```text
according to the Doctrine
```

or references:

```text
Eduto Doctrine
School Intelligence & Workflow Layer
DOCTRINE -> STRATEGY -> MASTER precedence
```

it must **not** be used as an implementation instruction without reconciling it against the current documentation registry and Master Roadmap.

---

## Final invariant

> **There is one active SkillStorm product/documentation hierarchy. Historical strategy may explain how we arrived here, but it cannot silently override the current roadmap, security contracts, curriculum data contract or production contract.**