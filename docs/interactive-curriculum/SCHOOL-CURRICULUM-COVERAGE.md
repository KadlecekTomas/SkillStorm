# SkillStorm — School Curriculum Coverage & ŠVP Integration

> **Status:** `VISION / APPROVED`  
> **Owner:** Curriculum + Product  
> **Last verified:** 2026-08-07  
> **Scope:** ZŠ; school-facing curriculum UX, coverage strategy and experience-family map across the current revised RVP ZV  
> **Normative contracts:** [`PRODUCTION-CONTRACT.md`](./PRODUCTION-CONTRACT.md) · [`CURRICULUM-DATA-CONTRACT.md`](./CURRICULUM-DATA-CONTRACT.md)  
> **Authority rule:** this file is a product/curriculum blueprint. If an example or sketch conflicts with a normative contract, the normative contract wins.

---

## 0. Purpose

SkillStorm must not behave like a catalogue where a teacher searches thousands of activities and manually guesses whether they fit the school's curriculum.

The target workflow is the opposite:

```text
RVP / canonical framework release
        ↓
versioned ŠVP of the concrete school
        ↓
school subject / integrated subject
        ↓
grade + school outcome + unit / plan
        ↓
approved curriculum mappings
        ↓
Lesson Experiences suitable for this class
        ↓
learning evidence + teacher planning
```

A school may:

- use different subject names;
- integrate several RVP fields into one subject;
- place outcomes in different grades;
- transition between curriculum versions by cohort;
- have its own school outcomes and projects;
- use very different classroom hardware.

SkillStorm therefore maps **curriculum meaning**, not filenames, topic labels or hardcoded subject names.

---

# 1. Authoritative Czech baseline

As last verified on **2026-08-07**, the revised RVP ZV contains **10 educational areas**:

| Code | Educational area |
| --- | --- |
| `JJK` | Jazyk a jazyková komunikace |
| `MAT` | Matematika a její aplikace |
| `INF` | Informatika |
| `CJS` | Člověk a jeho svět |
| `CAS` | Člověk a společnost |
| `GEO` | Geografie |
| `CAP` | Člověk a příroda |
| `UAK` | Umění a kultura |
| `CZB` | Člověk, zdraví a bezpečí |
| `CSP` | Člověk, jeho osobnost a svět práce |

Authoritative browser/export source:

- `https://prohlednout.rvp.cz/zakladni-vzdelavani/`
- `https://prohlednout.rvp.cz/export`

The official implementation schedule currently requires schools to align at least grades 1 and 6 from **1 September 2028**, with gradual expansion to all grades by **1 September 2032**:

- `https://revize.rvp.cz/zv/blog/harmonogram-implementace-rvp-zv`

These dates and structures are **source metadata, not hardcoded business constants**. A production framework import stores source provenance and an immutable fingerprint as required by the Curriculum Data Contract.

---

# 2. RVP, ŠVP and school subject are different layers

## 2.1 RVP

Canonical national framework and its versioned release.

It provides the authoritative structure and expected learning outcomes (OVU) for that release.

## 2.2 ŠVP

The school's own published curriculum version.

It may organize the canonical framework differently, including integrated subjects and different grade placement.

## 2.3 School subject

The subject a teacher actually sees in the timetable.

Examples:

```text
RVP fields: Fyzika + Chemie + Přírodopis
School subject: Přírodní vědy
```

or:

```text
RVP area: Člověk a jeho svět
School subjects: Prvouka / Vlastivěda / Přírodověda
```

No production query may assume:

```text
SchoolSubject.title === FrameworkField.title
```

## 2.4 SkillStorm content

A Lesson Experience is aligned through reviewed mappings to canonical outcome(s), required outcome aspects and/or school outcomes.

Topic tags and recommended grades help discovery. They are not curriculum authority.

---

# 3. Concurrent curriculum versions are mandatory

During the transition period, one school can legitimately use different ŠVP/framework versions for different grades or classes in the same academic year.

Example:

```text
2029/30
GRADE_1, GRADE_2  -> NEW curriculum
GRADE_3..GRADE_5  -> LEGACY curriculum
GRADE_6, GRADE_7  -> NEW curriculum
GRADE_8, GRADE_9  -> LEGACY curriculum
```

Therefore SkillStorm must **not** use a single organization-wide `curriculumVersion` or one `frameworkId` on a school curriculum as the complete applicability model.

Resolution is defined normatively in [`CURRICULUM-DATA-CONTRACT.md`](./CURRICULUM-DATA-CONTRACT.md) through versioned curriculum profiles and scope-aware applicability by academic year, grade and optionally class section.

Ambiguous active applicability is a blocking configuration error. Runtime may not silently choose a record.

---

# 4. Curriculum-aware teacher home

A teacher should normally start from the concrete class and school curriculum context, not the global library.

Example target UI:

```text
7.B · Přírodní vědy · 2028/29

Current unit
Ekosystémy

Teaching plan
5 of 8 planned lessons taught

Curriculum mapping
12 of 13 school outcomes reviewed

Recommended Lesson Experiences

[ Ecosystem Web ]
25 min · BOARD_ONLY · supports 2 approved school outcomes

[ Pond Investigation ]
45 min · HYBRID · field activity

[ Food Web Challenge ]
20 min · SHARED_DEVICES
```

### Forbidden UI shortcut

```text
ŠVP progress 68 %
```

unless the UI explicitly says what numerator, denominator and metric the percentage represents.

SkillStorm keeps at least four different dimensions separate:

1. **Content coverage** — do approved SkillStorm experiences exist for required curriculum aspects?
2. **Mapping completeness** — how much of the school's curriculum has reviewed canonical/content mappings?
3. **Delivery progress** — what was planned and what was actually taught?
4. **Learning evidence / mastery** — what learners have demonstrated under an explicit evidence policy?

These dimensions must never be collapsed into a single vague school score.

---

# 5. Coverage semantics

Normative states:

```text
MISSING
PARTIAL
COVERED
NOT_APPLICABLE
NEEDS_REVIEW
```

The exact computation and entities are defined by the Curriculum Data Contract.

## `MISSING`

No sufficient approved content path exists for one or more applicable required outcome aspects.

## `PARTIAL`

Some required aspects have approved support/evidence paths, but complete reviewed coverage is not established.

## `COVERED`

All applicable aspects marked as required for coverage have sufficient approved content/evidence paths under the current review policy.

`COVERED` does **not** mean:

- one activity exists;
- the school already taught the outcome;
- every learner mastered the outcome;
- a tag or AI similarity score matched the outcome text.

## `NOT_APPLICABLE`

The outcome/aspect is outside the resolved school curriculum scope.

## `NEEDS_REVIEW`

A source release, ŠVP version, mapping, outcome aspect, evidence specification or content version changed in a way that invalidates the previous approval.

### Important terminology rule

Use `NEEDS_REVIEW` consistently. `REVIEW_REQUIRED` is not a second production state.

---

# 6. Learning evidence is part of alignment

A weak mapping is:

```text
Activity -> OVU
```

A production mapping needs a reconstructable evidence path:

```text
Lesson Experience version
↓
Activity version
↓
checkpoint / semantic learner action
↓
evidence specification
↓
outcome aspect
↓
approved mapping/review
```

Example:

```text
GEO Climate Lab

Evidence path:
- selected relevant map layers
- interpreted climate data
- explained a regional difference
- transferred reasoning to a new location
```

The platform stores what was actually observed and must not infer more than the evidence policy supports.

Completion is not mastery.

---

# 7. ŠVP onboarding

Target onboarding for a school curriculum admin:

```text
1. Select academic year
2. Select/import applicable framework release(s)
3. Define transition applicability by grade/class if necessary
4. Create/import a versioned ŠVP
5. Define school subjects and school outcomes
6. Review proposed canonical mappings
7. Publish the school curriculum version
8. Improve mapping completeness iteratively
```

The school must not be forced to review hundreds of mappings before it can use any content. Generic approved canonical content remains discoverable while school-specific mapping improves.

### AI rule

AI may suggest a mapping.

AI may not itself turn a proposal into an approved curriculum claim.

The reviewer must be able to see why a mapping was proposed and what source text/version it refers to.

---

# 8. ŠVP import strategy

## Phase 1 — production priority

Prefer structured, reviewable import:

- Excel;
- CSV;
- guided editor.

Recommended fields include:

| Field | Example |
| --- | --- |
| School subject | Přírodní vědy |
| Grade | 7 |
| Period / unit | Září–říjen |
| School outcome | Vysvětlí vztah mezi... |
| Canonical RVP outcome | CAP-... |
| Topic | Ekosystém |
| Planned hours | 8 |

The exact import schema must be versioned and validated.

## Phase 2 — assisted document import

DOCX/PDF flow:

```text
immutable school source file
→ extraction
→ proposed structure
→ source anchors
→ human review
→ published SchoolCurriculumVersion
```

Forbidden claim:

> „Upload PDF → SkillStorm pochopil vaše ŠVP na 100 %.“

Extraction is assistance, not publication authority.

---

# 9. School curriculum dashboard

A useful dashboard makes the metric explicit.

Example:

```text
7.B · Přírodní vědy · 2028/29

Curriculum mapping
92 % reviewed
12 approved · 1 needs review

Content availability
78 % covered
17 % partial
5 % missing

Teaching plan — current term
64 % planned

Delivery — current term
41 % taught

Learning evidence
Open outcome/cohort view →
```

Every percentage must expose:

- metric name;
- numerator;
- denominator;
- scope;
- data freshness;
- excluded / `NOT_APPLICABLE` items.

A director-level rollup may aggregate subjects, but it may not merge different metric types.

---

# 10. Hardware-aware recommendation

Curriculum relevance and classroom hardware are separate constraints.

Example school equipment:

- one interactive board;
- six tablets;
- no 1:1 devices.

SkillStorm can recommend the same curriculum through different delivery modes:

```text
Chemistry
→ BOARD_ONLY Chem Lab

Geography
→ BOARD_ONLY Map Lab

Mathematics
→ SHARED_DEVICES station rotation

Czech language
→ BOARD_ONLY Audio Lab

Informatics
→ schedule DEVICES lesson in the PC room
```

A Lesson Experience declares supported and recommended modes. The teacher chooses among supported modes.

---

# 11. Integrated subjects are first-class

Example school subject:

> **Příroda a technologie**

It may contain school outcomes mapped to:

- `CAP` / physics;
- `CAP` / chemistry;
- `CAP` / biology;
- `INF`;
- `CSP` / polytechnic content.

Teacher UX continues to use the school's subject name.

Content discovery resolves through reviewed mappings, not through string equality.

---

# 12. Grade is recommendation + school decision

A Lesson Experience may declare:

```text
recommendedGrades: [7, 8]
```

but a school may legitimately teach the mapped outcome in grade 6.

SkillStorm can explain the mismatch without blocking the teacher:

> Tato aktivita je doporučena pro 7.–8. ročník. Ve vašem publikovaném ŠVP je daný cíl zařazen v 6. ročníku. Aktivitu lze použít; zvažte vyšší scaffolding.

Recommended grade is not curriculum authority.

---

# 13. Experience-family map across all 10 RVP ZV areas

This section is a **product discovery map**, not a claim that every listed experience already exists or that every OVU is covered.

Each production Lesson Experience still requires explicit mappings, evidence, accessibility and review gates.

## 13.1 Jazyk a jazyková komunikace (`JJK`)

### Czech language and literature

Primary product families:

- **Language Studio** — sentence/text manipulation, vocabulary and grammar reasoning;
- **Audio Learning** — phonological discrimination, listening and timed text;
- **Text Lab** — reading comprehension, source comparison and editing;
- **Media Lab** — argumentation, misinformation and communication context;
- **Literature Studio** — interpretation, structure, perspective and reflection.

Example experiences:

- `MÁ–MA Audio Lab`;
- Sentence Parser;
- Listening Detective;
- Text under the Microscope;
- Argument Clinic;
- Editorial Room.

Digital interaction must complement, not replace, actual reading, writing and speaking.

### English and other foreign languages

Primary product families:

- listening discrimination;
- dialogue branching;
- vocabulary in context;
- pronunciation/reference playback where pedagogically justified;
- sentence construction;
- communicative scenario practice.

Microphone use is optional unless a specific reviewed activity explicitly requires it and a non-microphone alternative is provided where necessary for accessibility/privacy.

---

## 13.2 Matematika a její aplikace (`MAT`)

Primary product families:

- **Math Manipulative Engine**;
- geometry/construction visualization;
- number and fraction manipulatives;
- graph/data exploration;
- multi-step problem solving;
- estimation and reasoning challenges.

Examples:

- Fraction Builder;
- Function/Graph Explorer;
- Geometry Lab;
- Budget/Ratio Challenge;
- Error Detective.

The system must reward reasoning/evidence, not only final numeric answers where the learning objective requires process understanding.

---

## 13.3 Informatika (`INF`)

Primary product family:

- **Interactive IT Lab**.

Examples:

- Build a PC;
- Build a Network;
- Data Representation Lab;
- Algorithm Builder;
- Debug the Program;
- Cybersecurity scenarios;
- Operating-system troubleshooting.

Detailed subject blueprint: [`../interactive-it-lab/README.md`](../interactive-it-lab/README.md).

The first production slice should validate a reusable Activity/Orchestration foundation rather than become a one-off hardcoded game.

---

## 13.4 Člověk a jeho svět (`CJS`)

Primary product families:

- visual exploration;
- local map/time/context activities;
- observation and classification;
- simple systems and life-situation scenarios;
- real-world mini investigations.

Examples:

- My Municipality;
- Seasons & Observation;
- Safe Route to School;
- Local History Timeline;
- Nature Around Us.

On-screen time should remain short and connected to observation, discussion or real-world activity.

---

## 13.5 Člověk a společnost (`CAS`)

### History

Primary families:

- timeline;
- historical map;
- source analysis;
- cause/consequence chains;
- perspective comparison;
- evidence-based scenario discussion.

Examples:

- Source Detective;
- Timeline Builder;
- Map of Change;
- Cause & Consequence Lab.

Simulations must not present speculative branching as historical fact.

### Civic education / finance

Primary families:

- decision scenarios;
- public-institution simulations;
- household/public budget activities;
- media/information evaluation;
- rights/responsibilities scenarios.

Sensitive political/civic content requires source provenance and balanced, age-appropriate framing. SkillStorm must not profile pupils politically.

---

## 13.6 Geografie (`GEO`)

Primary product family:

- **Map Engine**.

Examples:

- Climate Layers;
- Population & Settlement;
- Route/Accessibility planning;
- Disaster Risk Map;
- Regional Comparison;
- Field Observation integration.

A map activity should emphasize interpretation and evidence, not only clicking named locations.

---

## 13.7 Člověk a příroda (`CAP`)

### Physics

Primary product family:

- **Physics Lab Engine**.

Examples:

- Force/Motion Lab;
- Circuit Builder;
- Energy Transfer;
- Optics Lab;
- Measurement/Error activity.

Simulations must expose their model assumptions and must not replace required real experiments where physical experience is the learning objective.

### Chemistry

Primary product family:

- **Chem Lab Engine**.

Examples:

- pH / Neutralization;
- Particle View;
- Mixtures and Separation;
- Reaction Evidence;
- Lab Safety scenarios.

Virtual chemistry may safely rehearse concepts and procedures, but it must not encourage unsupervised replication of hazardous experiments.

### Biology / Natural science

Primary product families:

- system/exploded visual models;
- ecosystem relations;
- classification;
- microscopy/observation interpretation;
- evidence-based investigation.

Examples:

- Cell Explorer;
- Ecosystem Web;
- Adaptation Lab;
- Body Systems;
- Observation Notebook.

---

## 13.8 Umění a kultura (`UAK`)

### Visual / film education

Primary families:

- composition and visual-language experimentation;
- storyboard/shot planning;
- image/source comparison;
- reflection and critique workflow.

SkillStorm complements actual creative production; it does not replace drawing, painting, photography or film making.

### Music / dance / drama

Primary families:

- rhythm/listening exploration;
- arrangement/layering concepts;
- performance planning;
- dramatic branching and character motivation;
- reflection.

Preferred loop:

```text
SkillStorm model / prompt
→ real music / movement / performance
→ SkillStorm reflection / evidence
```

---

## 13.9 Člověk, zdraví a bezpečí (`CZB`)

### Health and safety

Primary product family:

- **Health & Safety Scenario Engine**.

Examples:

- first-aid decision scenarios;
- emergency/evacuation decision making;
- personal safety;
- healthy routine reasoning;
- age-appropriate online safety.

Sensitive health or personal topics require privacy-by-design, no public individual scoring and no diagnostic AI claims.

### Physical education

Primary role:

- **Movement Orchestrator**, not a fitness-tracking product.

Examples:

- station rotations;
- tactical board;
- movement challenge cards;
- warm-up guidance;
- personal reflection.

If the digital layer keeps pupils on a screen instead of moving, the experience is incorrectly designed.

---

## 13.10 Člověk, jeho osobnost a svět práce (`CSP`)

### Personal/social education

Primary families:

- reflection;
- communication/conflict scenarios;
- teamwork and project retrospectives;
- career exploration.

Private self-reflection is sensitive data. It must not automatically become public, graded, ranked or broadly accessible.

### Polytechnic / practical activities

Primary product family:

- **Workshop & Project Engine**.

Examples:

- Build Before You Build;
- Measure → Plan → Make;
- Repair Don't Replace;
- Garden Planner;
- Home Maintenance;
- Sensor Project;
- Simple Automation.

Preferred loop:

```text
DIGITAL PLAN
→ REAL BUILD / PRACTICE
→ MEASURE RESULT
→ REFLECT
```

---

# 14. Cross-curricular experiences

High-value missions can span several school subjects/outcomes.

Examples:

### Sustainable School

- geography;
- mathematics;
- physics;
- civic education;
- informatics;
- sustainability links.

### School Garden

- `CJS` / biology;
- mathematics;
- polytechnic activities.

### Plan a School Trip

- geography;
- mathematics;
- foreign language;
- finance/civic reasoning.

### Information Crisis

- Czech language/media literacy;
- informatics;
- civic education;
- history/source reasoning.

### Disaster Response

- geography;
- physics;
- health/safety;
- civic decision making.

### Build a Tiny House

- mathematics;
- physics;
- polytechnic activities;
- visual design;
- financial reasoning.

A cross-curricular experience must store mappings to each claimed outcome/aspect separately. One subject mapping must not imply the others.

---

# 15. Content publishing gate

A production Lesson Experience must not be advertised as curriculum-aligned until it satisfies the Definition of Ready/Done and release gates in [`PRODUCTION-CONTRACT.md`](./PRODUCTION-CONTRACT.md).

At curriculum level this includes at least:

- immutable content/activity version;
- approved canonical/school mapping where claimed;
- evidence specification for claimed evidence paths;
- pedagogical review;
- accessibility plan/review;
- supported/recommended delivery modes;
- asset/source provenance;
- privacy/data classification;
- non-stale mappings under the active curriculum release.

Prototype content can exist as `UNMAPPED / PROTOTYPE`, but it contributes zero production coverage.

---

# 16. Search and recommendations

Teacher search/ranking can combine:

- resolved school curriculum context;
- approved outcome mappings;
- school subject and grade;
- current teaching plan/unit;
- lesson duration;
- available hardware;
- delivery mode;
- difficulty;
- scaffolding/support;
- accessibility needs;
- content quality/review status.

Every curriculum-aware recommendation should be explainable, for example:

```text
Recommended because:
✓ mapped to your published ŠVP for 7.B
✓ supports school outcome PRI-7-04
✓ 30 minutes
✓ works BOARD_ONLY
```

A recommendation may be useful even when mapping is incomplete, but the UI must distinguish canonical/general relevance from reviewed school-specific relevance.

---

# 17. History must not be rewritten

A taught lesson/session must remain interpretable under the exact curriculum/content context that applied at the time.

Later changes to:

- RVP release;
- ŠVP version;
- school mapping;
- outcome aspects;
- Lesson Experience;
- Activity version;
- evidence policy;

must not silently reinterpret historical results.

Historical sessions reference immutable/versioned curriculum context as defined by the Curriculum Data Contract.

---

# 18. Coverage-driven product backlog

Not every missing Lesson Experience has the same value.

A prioritization model can consider:

```text
curriculum importance / requiredness
× number of applicable grades/schools
× size of current coverage gap
× reuse across subjects
× interactive pedagogical advantage
÷ implementation + content-review cost
```

This is a prioritization heuristic, not an automated decision rule.

Final prioritization remains a product/pedagogy decision using pilot evidence.

---

# 19. Recommended development order

Subject order is governed by [`../roadmap/master.md`](../roadmap/master.md), not by this file.

As a product heuristic, early engines should deliberately test different classroom constraints:

1. one strong `BOARD_ONLY`-first science experience;
2. one `DEVICES`-first practical informatics experience;
3. one audio/language experience that works without mandatory microphones;
4. one map/geography experience;
5. additional physics/math/biology and language slices;
6. humanities, health, arts and polytechnic layers after the shared engine contracts are proven.

Do not build many subject engines in parallel before the shared Activity/Classroom Orchestration foundation has survived real classroom pilots.

---

# 20. What “SkillStorm fits our ŠVP” must mean

Minimum production contract:

```text
[ ] school has a published curriculum profile/version
[ ] applicable framework/ŠVP resolves unambiguously for class + academic year
[ ] school subjects may use arbitrary names
[ ] integrated subjects map to multiple canonical fields/outcomes
[ ] school outcomes can be reviewed against canonical outcomes/aspects
[ ] teacher recommendations use the school's resolved context
[ ] Lesson Experiences expose what they support and why
[ ] content/mapping/delivery/evidence metrics are separate
[ ] mappings and evidence are versioned
[ ] AI proposals require human approval for curriculum claims
[ ] legacy + revised curricula can coexist during transition
[ ] coverage is aspect-aware and pedagogically reviewable
[ ] history remains reproducible after later curriculum changes
```

---

# 21. What curriculum coverage does NOT mean

SkillStorm must never claim coverage merely because:

- a PDF exists on the same topic;
- a quiz has a similar title;
- an activity has a `chemistry`/`grade-7` tag;
- AI found semantic similarity;
- one lesson points to a broad OVU;
- a teacher opened a material;
- a learner completed an activity once.

Production curriculum coverage means:

> **For the applicable curriculum scope, required outcome aspects have reviewed SkillStorm content/evidence paths under a versioned policy, and the system can reconstruct why the coverage claim exists.**

---

# 22. Acceptance criteria for this blueprint

Before implementation based on this document begins, the following must remain true:

- no data-model sketch in this file competes with the Curriculum Data Contract;
- no UI example uses an undefined generic `ŠVP progress` metric;
- `NEEDS_REVIEW` is the only review-invalidated coverage state;
- `COVERED` requires all applicable required aspects under the review policy, not one activity;
- official RVP facts are traceable to authoritative/versioned sources;
- school-specific data is tenant-scoped;
- AI cannot approve curriculum claims;
- integrated subjects and concurrent curriculum versions are first-class;
- current implementation is not presented as if the future curriculum layer already exists.

---

## Final product principle

> **SkillStorm should translate a school's real, versioned curriculum into usable Lesson Experiences for the hardware and class the teacher actually has — while remaining able to explain exactly which source, mapping, content version and learning evidence support every curriculum claim.**