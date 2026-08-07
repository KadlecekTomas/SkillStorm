# SkillStorm — Parťák 2.0 Product Vision

> **Status:** `VISION / PARKED — REQUIRES PILOT EVIDENCE`  
> **Owner:** Product  
> **Last verified:** 2026-08-07  
> **Priority:** after current Guardian work, Interactive Curriculum foundation and real-school pilot evidence  
> **Current rules:** [`../partak-rules.md`](../partak-rules.md)  
> **Authority rule:** this file describes optional future product exploration. It does not override current ClassParták rules, privacy/security contracts or the Master Roadmap.

---

## 0. Thesis

Parťák 2.0 explores whether a pupil-owned companion can deepen emotional attachment to personal learning progress without introducing competitive pressure, pay-to-win mechanics or purchase pressure on children.

The concept has four possible layers:

1. pupil chooses a companion species;
2. visual evolution follows participation milestones;
3. a private collectible album records milestones;
4. optional adult-only physical memorabilia is tested only after demand is proven.

This is **not approved implementation scope yet**.

---

# 1. Non-negotiable product boundaries

Any future Parťák 2.0 implementation must preserve:

```text
[ ] XP cannot be purchased
[ ] companion species has no gameplay advantage
[ ] rewards are not based on being better than classmates
[ ] no pupil leaderboard or cross-pupil comparison
[ ] pupil UI contains no prices, cart, upsell or purchase pressure
[ ] physical products, if any, are adult-facing only
[ ] no dark pattern such as “ask your parent to buy this”
[ ] learning evidence/mastery remains separate from companion progression
[ ] tenant/privacy rules prevent access to another child's private collection
[ ] accessibility and age-appropriate presentation are designed from the start
```

Current ClassParták participation rules remain authoritative until a separately approved migration changes them.

---

# 2. Phase A — companion choice

Hypothesis:

> A child forms a stronger attachment when the companion is chosen rather than assigned.

Possible species concept:

- dragon;
- owl;
- fox;
- cat / feline companion.

Final species, naming and artwork require age testing and professional visual review.

### Constraints

- choice is cosmetic;
- existing progression is preserved;
- choice must not create different reward rates or capabilities;
- a safe migration/reselection policy must exist for existing pupils;
- younger and older pupil presentation may differ without changing mechanics.

### Evidence required before implementation

Pilot/research should show that pupils actually notice, value and discuss the current companion concept. If the current mechanic has low emotional value, producing dozens of premium assets is poor ROI.

---

# 3. Phase B — visual evolution

Hypothesis:

> Visible evolution can make long-term participation milestones emotionally legible without exposing scores or rankings.

Potential design:

```text
stage milestone
→ one-time evolution moment
→ new visual form
→ private historical record
```

The current stage mechanics must not be silently changed merely to make evolution happen faster.

### Age adaptation

For younger pupils:

- expressive companion art;
- stronger transformation moment.

For older pupils:

- more restrained emblem/identity treatment;
- no infantilizing presentation.

Age mode changes presentation, not reward logic.

---

# 4. Phase C — private album

A future album could contain non-competitive memories such as:

- companion evolution cards;
- campaign/mission participation stickers;
- first-use or long-term participation milestones;
- seasonal or school-year memories where pedagogically appropriate.

### Explicit exclusions

Do not create awards such as:

- `100 % test score`;
- `best in class`;
- `faster than classmates`;
- public sticker counts;
- completion percentage visible to others as status.

### Privacy default

The album belongs to the pupil's private experience.

No system-wide feed, public profile or automatic peer comparison is part of this vision.

Any guardian visibility must be separately designed and justified; it is not implied merely because a guardian is linked to a child.

---

# 5. Phase D — optional physical memorabilia

This is a **business experiment**, not a prerequisite for the learning product.

Potential products could include:

- printed sticker sheet after a campaign/class milestone;
- evolution cards;
- printable/physical class certificate;
- companion plush only if demand becomes real and manufacturing economics are validated.

### Commerce red lines

- child never sees prices or a cart;
- adult initiates purchase;
- no limited-time pressure targeted at children;
- purchase never changes digital progression or learning result;
- no manufacturing inventory before demand validation;
- legal/tax/consumer terms are reviewed before selling physical goods.

A low-tech/manual order pilot is preferable to building e-commerce infrastructure before demand is proven.

---

# 6. Required pilot questions

Before Phase A is scheduled, research should answer:

1. Do pupils spontaneously notice or talk about the companion?
2. Does it motivate return/participation without teacher prompting?
3. Which age groups respond positively vs find it childish?
4. Do pupils care about “what happens next” in progression?
5. Do guardians/teachers value the concept or see it as distraction?
6. Is there any organic adult demand for physical memorabilia?
7. Does the mechanic create unintended pressure/comparison between pupils?

Qualitative excitement alone is insufficient; capture observed behavior and teacher burden as well.

---

# 7. Cost / ROI gate

High-quality companion evolution is asset-heavy.

Before commissioning a full asset set, estimate:

```text
species count
× evolution stages
× age variants
× animation states
× localization/marketing variants if applicable
```

Then compare that cost to measured pilot value.

A small, excellent set of assets is preferable to many inconsistent variants.

---

# 8. Technical direction — only if promoted from vision

If the concept becomes approved work, implementation should prefer additive, versioned data rather than repurposing assessment fields.

Potential domain concepts may include:

```text
PupilCompanionPreference
CollectibleDefinition
CollectibleAward
EvolutionEvent
```

Exact schema is intentionally **not frozen here**.

Any award record must have:

- deterministic source/provenance;
- idempotency;
- tenant + pupil ownership;
- explicit visibility;
- safe deletion/anonymization behavior.

Do not add schema solely because a roadmap sketch names a model.

---

# 9. Promotion gate from PARKED to NEXT

Parťák 2.0 can enter scheduled implementation only when:

```text
[ ] Master Roadmap explicitly prioritizes it
[ ] current school pilot evidence supports the hypothesis
[ ] age-group response is understood
[ ] privacy/child-design review passes
[ ] asset budget + ownership/licensing are approved
[ ] current ClassParták contract migration is explicitly designed
[ ] no pay-to-win / purchase-pressure path exists
[ ] measurable product success criteria are defined
```

Until then this document is ideation, not engineering backlog.

---

## Final principle

> **Parťák 2.0 is valuable only if it strengthens a child's relationship with learning without turning achievement into status or the child into a sales channel. Pilot evidence decides whether it deserves implementation.**