# SkillStorm Subject Blueprint — Polytechnická výchova a praktické činnosti

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy + Polytechnics Review  
> **Last review:** 2026-08-08  
> **Scope:** Polytechnická výchova a praktické činnosti na ZŠ; konkrétní dílenské, technické, domácí, pěstitelské a projektové činnosti určuje ŠVP školy.  
> **Purpose:** production-spec `Workshop & Project Engine` — plánování, materiály, nástroje, bezpečnost, konstrukce, automatizace a skutečná práce mimo obrazovku.

---

## 1. Subject promise

**SkillStorm má připravit žáka na skutečnou technickou a praktickou činnost: promyslet cíl, zvolit materiál a nástroj, naplánovat postup, pracovat bezpečně, něco vytvořit, změřit výsledek a reflektovat chyby.**

Základní smyčka:

```text
BRIEF / NEED
  ↓
PLAN
  ↓
SELECT MATERIAL / TOOL
  ↓
SAFETY CHECK
  ↓
BUILD / GROW / REPAIR / AUTOMATE OFF-SCREEN
  ↓
MEASURE / TEST
  ↓
REVISE
  ↓
REFLECT
```

---

## 2. Kurikulární pozice

Polytechnická výchova a praktické činnosti je obor oblasti `Člověk, jeho osobnost a svět práce`. Školy jej mohou realizovat různými způsoby: dílny, technika, konstrukce, domácnost, zahrada, projekty, automatizace a další praktické činnosti.

SkillStorm proto nabízí reusable workshop/project vrstvu, nikoli jednu pevnou „dílnu v aplikaci“.

---

## 3. Pedagogický model

Centrální je **reálný výrobek/proces**, ne virtuální replika.

Digitál pomáhá:

- číst zadání/plán;
- vybrat materiál;
- spočítat rozměry/spotřebu;
- zobrazit bezpečnostní body;
- naplánovat pořadí;
- simulovat předem drahou/nevratnou chybu;
- řídit projekt;
- zaznamenat měření;
- reflektovat finální výrobek/proces.

---

## 4. Delivery modes

### `BOARD_ONLY`
Brief, bezpečnost, plán, společná demonstrace.

### `SHARED_DEVICES` — velmi silný
Jedno zařízení na skupinu/projektový tým mimo nebezpečnou pracovní zónu.

### `DEVICES`
Design/planning/data/automation lesson, ne zařízení v ruce při rizikové činnosti.

### `HYBRID` — primární
Digitální plán → skutečná dílna/zahrada/domácí/projektová činnost → test/reflexe.

---

## 5. Lesson archetypes

1. `Workshop Planner`
2. `Material Decision`
3. `Tool Choice`
4. `Sequence & Safety`
5. `Measure → Build → Check`
6. `Repair Don't Replace`
7. `Construction Challenge`
8. `Prototype → Test → Revise`
9. `Automation Logic`
10. `Garden / Growing Plan`
11. `Household Process`
12. `Project Sprint`
13. `Failure Analysis`
14. `Budget & Material Optimization`

---

## 6. Recommended progression

### 1.–3. ročník
- jednoduchý postup;
- bezpečné zacházení s běžnými materiály dle pedagoga;
- skládání/konstrukce;
- pořadí kroků;
- úklid a odpovědnost;
- fyzická práce jako dominantní.

### 4.–5. ročník
- plánování jednoduchého výrobku/projektu;
- měření;
- volba materiálu;
- zahrada/domácnost/projekt podle ŠVP;
- jednoduchá kontrola výsledku.

### 6.–7. ročník
- výkres/plán;
- přesnější měření;
- pracovní postup;
- bezpečnost nástrojů;
- konstrukce a oprava;
- projektové role.

### 8.–9. ročník
- komplexnější konstrukce;
- rozpočet/materiál trade-offs;
- diagnostika závady;
- automatizace/řízení v rozsahu ŠVP;
- dokumentace projektu;
- kariérová souvislost bez deterministického doporučení povolání.

---

## 7. Experience catalog

### POLY-01 — Workshop Planner
Výrobek → materiál → nástroje → pořadí → safety checkpoints.

### POLY-02 — Material Lab
Porovnání materiálů podle mechanických/praktických vlastností, ceny a použití. Reálné testy mohou následovat.

### POLY-03 — Tool Choice
Vyber vhodný nástroj k operaci a vysvětli bezpečnostní důvod.

### POLY-04 — Sequence Builder
Seřaď kroky výroby; některé chyby mají fyzický důsledek v modelu.

### POLY-05 — Measure Twice
Žák pracuje s rozměry a tolerancí; cross-link na matematiku.

### POLY-06 — Cut Plan
Optimalizace využití materiálu na fiktivním sheet/board planu bez skutečného stroje.

### POLY-07 — Construction Challenge
Konstrukce musí splnit rozměr, stabilitu nebo jiný explicitní constraint; následně fyzická realizace.

### POLY-08 — Prototype & Test
První návrh je záměrně testován; selhání vede k revizi.

### POLY-09 — Repair Don't Replace
Fiktivní výrobek/systém má závadu. Žák diagnostikuje, co lze opravit a co je potřeba vyměnit.

### POLY-10 — Fastener / Joint Decision
Výběr způsobu spojení podle materiálu a cíle v bezpečném didaktickém modelu.

### POLY-11 — Garden Planner
Záhon/plodiny/voda/slunce/čas; následně reálná pěstitelská činnost podle školy.

### POLY-12 — Watering Decision
Data o půdě/počasí/nádrži jsou lesson input, ne automatický návod bez teacher context.

### POLY-13 — Household Process
Plán praktické činnosti s důrazem na bezpečnost, hygienu, postup a odpovědnost podle ŠVP.

### POLY-14 — Automation Blocks
Sensor/condition/action jako logický model; cross-link na informatiku.

### POLY-15 — Build a Simple Controlled System
Model automatizace, následně fyzická stavebnice, pokud škola má hardware.

### POLY-16 — Project Sprint
Skupina má brief, role, materiálový budget, checkpointy a retrospektivu.

### POLY-17 — Failure Analysis
Hotový produkt nesplňuje constraint; žák měří a hledá příčinu.

### POLY-18 — Sustainable Material Decision
Více parametrů a trade-offs, žádné jediné „eco score“.

---

## 8. Teacher orchestration

```text
7.A · Praktické činnosti
Project: Simple shelf / model construction
Lesson: Plan → build → check
90 min block
Digital planning: 15 min
Workshop: 60 min
Reflection: 15 min

[Spustit]
```

Teacher actions:

- `SHOW BRIEF`;
- `SAFETY CHECK`;
- `APPROVE PLAN`;
- `PAUSE FOR WORKSHOP`;
- `CHECKPOINT`;
- `RECORD MEASUREMENT`;
- `SHOW REVISION`;
- `REFLECTION`.

Učitel může projekt zastavit kvůli bezpečnosti nezávisle na digitálním workflow.

---

## 9. Learning evidence

- plan;
- tool/material rationale;
- safety understanding;
- measurement;
- prototype/revision;
- diagnostic hypothesis;
- final test;
- project documentation;
- teacher observation;
- reflection.

SkillStorm nehodnotí manuální zručnost pouze podle fotografie nebo videa algoritmem.

---

## 10. Difficulty × scaffolding

### Explorer
- jasný plán;
- omezené materiály;
- explicitní safety steps.

### Builder
- žák volí část postupu;
- měření;
- jednoduchá revize.

### Technician
- materiál/tool choice;
- fault diagnosis;
- tolerance/constraints.

### Engineer
- open brief;
- budget/material trade-offs;
- prototype-test loop;
- automation/project documentation.

---

## 11. Accessibility/SVP

- digitální plán lze ovládat bez drag;
- audio/text instruction;
- visual step cards;
- role differentiation v týmu;
- fyzická činnost má teacher-defined accessible varianty;
- žádná veřejná nálepka „jednodušší práce“;
- možnost alternate project role, pokud fyzické omezení brání konkrétní operaci;
- safety never reduced by scaffolding;
- reduced visual clutter.

---

## 12. Content authoring

Project definition:

```text
WorkshopProject
├─ brief
├─ curriculum mappings
├─ material options
├─ tool requirements
├─ safety requirements
├─ dimensions/constraints
├─ planned steps
├─ approval checkpoints
├─ off-screen stages
├─ measurement/test criteria
├─ evidence
├─ alternatives/accessibility
└─ source/provenance
```

Safety rules jsou kurátorované a nejsou volně přepisovatelný text bez review.

---

## 13. Workshop & Project Engine contract

Capabilities:

- project plan;
- step/checkpoint flow;
- material/tool catalog;
- measurement entries;
- simple 2D layout/cut plan;
- budget;
- prototype versioning;
- teacher approval gate;
- off-screen stage;
- team roles;
- test criteria;
- semantic events.

Events:

```text
PLAN_CREATED
MATERIAL_SELECTED
TOOL_SELECTED
SAFETY_CHECK_COMPLETED
PLAN_APPROVED
MEASUREMENT_RECORDED
CHECKPOINT_COMPLETED
TEST_FAILED
REVISION_CREATED
PROJECT_COMPLETED
```

---

## 14. Safety governance

Tento obor má fyzické safety implications.

- každá lesson s nástrojem/činností má safety reviewer/teacher approval;
- žádné generativní instrukce k nebezpečné práci bez review;
- SkillStorm není náhrada dozoru;
- software nesmí dát `continue` jako důvod pokračovat, pokud učitel práci zastavil;
- zařízení nejsou používána v rizikové pracovní zóně;
- fotografie/videa dětí nejsou potřeba pro core workflow;
- konkrétní stroje/nástroje se uvádějí jen podle školního vybavení a bezpečnostního rámce.

---

## 15. Hero lesson A — Navrhni a postav jednoduchý výrobek

**Range:** 6.–8. ročník dle ŠVP  
**Mode:** `HYBRID`  
**Duration:** 2 vyučovací hodiny / blok

### 0–10 Brief
Výrobek má rozměr, funkční constraints a materiálový limit.

### 10–20 Plan
Skupina vytvoří rozměry, kroky, material/tool plan.

### Teacher approval gate
Bez teacher approval se digitální workflow nepřepne do `WORKSHOP`, ale fyzickou bezpečnost stejně řídí učitel mimo software.

### 20–70 OFF-SCREEN BUILD
Skutečná práce.

### 70–80 Measure/Test
Žák změří výsledek a porovná s constraints.

### 80–90 Reflection
Co jsme změnili proti plánu a proč?

Evidence: plan → measurement → revision → test.

---

## 16. Hero lesson B — Oprav systém

**Range:** 7.–9. ročník  
**Mode:** `SHARED_DEVICES` + physical model if available  
**Duration:** 45 min

Fiktivní/bezpečná konstrukce neplní funkci.

1. symptom;
2. initial hypothesis;
3. omezené measurements/tests;
4. repair plan;
5. test;
6. reflection.

Random replacement bez diagnostiky je méně kvalitní evidence než plánovaný test.

---

## 17. MVP vertical slice

**Workshop Planner + teacher approval + off-screen build + measurement reflection**

První MVP může používat jednoduchý školní výrobek/model, který nevyžaduje nový 3D engine.

Prokazuje:

- plan;
- materials/tools;
- safety gate;
- off-screen stage;
- measurement;
- revision;
- teacher control;
- team evidence.

---

## 18. Non-goals

- CAD/CAM suite;
- automatické ovládání skutečných školních strojů;
- AI generátor neověřených workshop instrukcí;
- nahrazení dílny simulátorem;
- camera-based skill scoring;
- jedna rigidní sada nástrojů pro všechny školy;
- katalog komerčních produktů;
- public „craftsmanship score“.

---

## 19. Production acceptance criteria

```text
[ ] polytechnics teacher/reviewer approved content
[ ] curriculum mapping reviewed
[ ] safety requirements explicit and reviewed
[ ] teacher approval gate supported where required
[ ] device use does not create workshop hazard
[ ] off-screen work is first-class stage
[ ] measurement/test criteria explicit
[ ] no AI/manual-skill camera grading
[ ] local equipment differences configurable
[ ] accessible role/variant supported
[ ] material/tool assets have provenance where external
[ ] project state reconnect safe
```

---

## 20. Pilot metrics

- planning time vs. workshop time;
- number/type of plan revisions;
- measurement accuracy relevant to task;
- safety workflow friction;
- teacher approval usability;
- device interference with physical work;
- team participation;
- technical incidents;
- teacher reuse intent.

---

## 21. Cross-curricular reuse

- matematika — rozměry, geometrie, rozpočet;
- informatika — automatizace;
- fyzika — měření/elektřina/material systems;
- chemie — materiály;
- přírodopis/ČJS — zahrada;
- OSV — project teamwork;
- výtvarná — design/kompozice.

---

## 22. Content coverage workflow

```text
School practical/polytechnic outcome
→ OVU/aspects
→ identify real physical task
→ safety/equipment context
→ choose planning/support capabilities
→ author project
→ teacher/safety review
→ accessibility
→ curriculum mapping approval
→ pilot in actual workshop/class context
→ publish
```

---

> **Final invariant:** Polytechnika v SkillStormu musí skončit u skutečné činnosti, výrobku, pozorování nebo funkčního systému. Když žák „postaví poličku“ jen drag-and-dropem na obrazovce a nikdy nic nezměří ani nevytvoří, nesplnili jsme cíl.