# SkillStorm Subject Blueprint — Informatika

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy + Informatics Review  
> **Last review:** 2026-08-08  
> **Scope:** Informatika na ZŠ; detailní device-first subject engine je dále rozpracován v `../../interactive-it-lab/README.md`.  
> **Purpose:** jednotný pedagogický blueprint informatiky nad Activity Engine, daty, algoritmy, informačními systémy a digitálními technologiemi.

---

## 1. Subject promise

**SkillStorm má informatiku učit jako konstrukci, modelování, práci s daty, algoritmické myšlení a diagnostiku systémů — ne jako poznávačku ikon a názvů zařízení.**

Základní smyčka:

```text
PROBLEM / SYSTEM
  ↓
MODEL / PLAN
  ↓
BUILD / PROGRAM / CONNECT / TRANSFORM DATA
  ↓
RUN
  ↓
OBSERVE
  ↓
DEBUG / DIAGNOSE
  ↓
EXPLAIN / IMPROVE
```

---

## 2. Kurikulární pozice

Informatika je samostatná oblast i obor. Produkční mapping se váže na konkrétní OVU/aspekty a ŠVP školy.

Product families:

- data, informace, modelování;
- algoritmizace/programování;
- informační systémy;
- digitální technologie;
- bezpečné/odpovědné používání digitálních systémů tam, kde se překrývá s VZB/občankou.

---

## 3. Pedagogický model

Žák má být **tvůrce a diagnostik**, ne pasivní konzument.

Preferované činnosti:

- rozdělit problém;
- sestavit postup;
- vytvořit model;
- propojit komponenty;
- transformovat data;
- navrhnout strukturu;
- testovat;
- debugovat;
- vysvětlit kompromis.

---

## 4. Delivery modes

### `DEVICES` — primární
PC učebna / 1:1 / dvojice.

### `HYBRID`
Board drží společný model a teacher intervention; žáci pracují na zařízeních.

### `BOARD_ONLY`
Vhodný pro algoritmické unplugged/board modely, systémové diagramy, debugging demo.

### `SHARED_DEVICES`
Skupinové system-building a data missions.

---

## 5. Lesson archetypes

1. `Build an Algorithm`
2. `Trace & Debug`
3. `Model Data`
4. `Clean / Transform / Interpret Data`
5. `Build an Information System`
6. `Connect the Network`
7. `Build a PC`
8. `Diagnose a Fault`
9. `Cyber Decision Scenario`
10. `Automate a Process`
11. `Compare Representations`
12. `Design under Constraints`

---

## 6. Recommended progression

### Early informatics
- sekvence, podmínka, opakování přes konkrétní model;
- informace/data;
- jednoduché modelování;
- bezpečné používání systému;
- pochopení vstup→zpracování→výstup.

### Middle stage
- algoritmy a programování;
- data structures v přiměřeném rozsahu;
- model informačního systému;
- komponenty počítače;
- síťové vztahy;
- debugging.

### Later stage
- větší systémy;
- databázové/modelovací koncepty;
- síť;
- kyberbezpečnostní rozhodování;
- optimalizace/diagnostika;
- práce s limity modelu/automatizace.

---

## 7. Experience catalog

### INF-01 — Algorithm Factory
Sekvence, opakování a podmínky v modelové výrobní lince.

### INF-02 — Human Robot
Board/unplugged instrukce odhalují nejednoznačnost algoritmu.

### INF-03 — Trace the Program
Žák předpovídá stav krok po kroku před spuštěním.

### INF-04 — Debug the Algorithm
Chyba není jen syntax; žák identifikuje příčinu špatného výsledku.

### INF-05 — Data Detective
Data mají chyby, duplicity, neúplnosti. Žák rozhoduje, co lze tvrdit.

### INF-06 — Data Pipeline
Vznik → formát → transformace → výstup.

### INF-07 — Model the System
Entity/vztahy/flows pro jednoduchý školní informační systém.

### INF-08 — Database Builder
Konceptuální práce s daty a strukturou, ne nutně konkrétní SQL syntax v každé škole.

### INF-09 — Inside the Computer
Komponenta → funkce → tok dat/energie.

### INF-10 — Build a PC
Detailní hero vertical slice v Interactive IT Lab.

### INF-11 — Boot Failure
Diagnostika podle symptomů a semantic evidence.

### INF-12 — Network Builder
PC/switch/router/AP/server/internet jako uzly modelu.

### INF-13 — Packet Journey
Konceptuální cesta informace sítí bez falešného „vidím reálné pakety“ tam, kde jde o model.

### INF-14 — Cyber Incident
Phishing, heslo, veřejná síť, ztracené zařízení, oprávnění, záloha; safe decision scenario.

### INF-15 — Permission Model
Role/oprávnění na fiktivním systému; cross-link na občanství/security.

### INF-16 — Automation Challenge
Žák navrhne opakovatelný proces a řeší výjimky.

### INF-17 — UI/Data Model Mismatch
Systém zobrazuje chybný výsledek; žák hledá, zda problém vznikl ve vstupu, logice nebo prezentaci.

### INF-18 — Digital Artifact Project
Žák vytvoří malý digitální výstup s plánem, testem a reflexí.

---

## 8. Teacher Mission Control

```text
7.B · Informatika
Build a PC
30 connected
18 working
7 completed
5 need help
Common bottleneck: RAM placement / compatibility

[Pause all] [Demo on board] [Resume]
```

Pedagogické signály:

- current checkpoint;
- meaningful error category;
- hints;
- repeated misconception;
- idle/reconnect;
- completion/transfer.

Ne raw screen/pointer monitoring.

---

## 9. Learning evidence

- algorithm/model;
- test case;
- debug hypothesis;
- component/system build;
- relevant configuration;
- data transformation;
- fault diagnosis;
- security decision rationale;
- explanation/reflection.

---

## 10. Difficulty × scaffolding

### Explorer
- guided structure;
- highlighted valid targets;
- small system.

### Builder
- functional construction;
- fewer hints;
- own test.

### Technician
- compatibility/diagnostics;
- multiple faults;
- constrained resources.

### Engineer
- trade-offs;
- larger system;
- optimization;
- failure analysis.

Scaffolding remains `GUIDED / ASSISTED / INDEPENDENT`.

---

## 11. Accessibility/SVP

- keyboard alternatives;
- tap-select instead of drag-only;
- code/algorithm blocks usable without precise pointer;
- screen-reader semantics where meaningful;
- reduced motion;
- explicit step focus;
- no speed leaderboard;
- visual system diagrams with text alternatives;
- adjustable complexity without lowering core learning goal.

---

## 12. Content authoring

Activity definition separates:

- mission;
- system/component catalog;
- rules;
- valid states;
- faults;
- checkpoints;
- assets;
- evidence;
- difficulty/scaffolding;
- curriculum mapping.

Build-a-PC content uses generic/fictive components unless licensing permits real brands.

---

## 13. Engine contract

Reuse / specialized capabilities:

- `SystemBuilderEngine`;
- graph/network;
- algorithm blocks;
- code runner only where safe/needed;
- data table/pipeline;
- deterministic rule engine;
- diagnostics/fault injection;
- Mission Control;
- semantic realtime events.

Events:

```text
ALGORITHM_STEP_ADDED
PROGRAM_RUN
TEST_FAILED
DEBUG_HYPOTHESIS_SUBMITTED
COMPONENT_PLACED
CONNECTION_CREATED
CONFIG_CHANGED
FAULT_DIAGNOSED
CHECKPOINT_COMPLETED
```

---

## 14. Security and sandboxing

- žádné spuštění nedůvěryhodného kódu na hostitelském serveru bez sandboxu;
- cyber lessons zůstávají defenzivní a věkově přiměřené;
- žádný skutečný credential collection;
- žádné screen spying;
- žádný raw keystroke logging;
- security model platformy se nesmí obcházet kvůli „lab“ režimu;
- tenant isolation platí i pro student activity state.

---

## 15. Hero lesson A — Build a PC

**Mode:** `DEVICES`  
**Duration:** 45 min

1. Identify components.
2. Install CPU/cooler/RAM/storage/GPU/PSU.
3. Connect basic power.
4. Power on.
5. Diagnose POST/fault.
6. Teacher Mission Control intervention.
7. Transfer to modified build.

Evidence: meaningful placements + faults + explanation, ne mouse path.

Detailní spec: `../../interactive-it-lab/README.md`.

---

## 16. Hero lesson B — Network Builder

**Mode:** `DEVICES` / `HYBRID`  
**Duration:** 45 min

### Hook
> Máš počítačovou učebnu, ale zařízení nekomunikují podle zadání. Navrhni síť.

Žáci propojí uzly, nastaví pouze didakticky relevantní properties a testují komunikaci.

Fault round přidá jednu závadu. Žák musí diagnostikovat před nahodilým přepojováním.

Evidence: topology + test + diagnosis + revision.

---

## 17. MVP vertical slice

`Build a PC` podle IT Lab blueprintu.

Prokazuje:

- 2.5D device renderer;
- semantic telemetry;
- Mission Control;
- difficulty/scaffolding separation;
- reconnect;
- system rules;
- diagnosis;
- accessible non-drag path.

---

## 18. Non-goals

- hardware e-shop;
- real brand catalog bez licencí;
- těžké realtime 3D v MVP;
- screen surveillance;
- offensive hacking lab;
- generic cloud IDE jako první feature;
- syntax drill jako identita informatiky;
- jeden hardcoded PC game bez reusable Activity Engine.

---

## 19. Production acceptance criteria

```text
[ ] informatics reviewer approved content
[ ] curriculum mapping reviewed
[ ] no secret/correct state leaked early
[ ] tenant/RBAC preserved
[ ] untrusted code sandboxed if code execution exists
[ ] no screen/pointer/keystroke surveillance
[ ] semantic realtime is reconnect/idempotency safe
[ ] 30-client classroom test passes for device mode
[ ] Mission Control exposes pedagogical signal
[ ] accessibility alternative to drag exists
[ ] assets/licensing reviewed
```

---

## 20. Pilot metrics

- time to first meaningful action;
- bottleneck checkpoints;
- random trial vs. diagnostic behavior;
- hints;
- reconnect;
- teacher interventions;
- transfer challenge;
- browser performance;
- teacher reuse;
- accessibility.

---

## 21. Cross-curricular reuse

- matematika — algoritmy/data;
- geografie — geodata;
- občanství/VZB — cyber/privacy;
- fyzika — circuits/systems;
- polytechnika — build/diagnose;
- jazyky/čeština — digital communication/media.

---

## 22. Content coverage workflow

```text
School informatics topic
→ OVU/aspects
→ reasoning type: algorithm/data/system/technology
→ reusable capability
→ author content/rules
→ informatics/security review
→ mapping approval
→ classroom performance test
→ pilot
→ publish
```

---

> **Final invariant:** Informatika v SkillStormu má žáka nechat systémy skutečně vytvářet, testovat a opravovat. Pokud se z ní stane digitální učebnice s otázkami, promarnili jsme její nejsilnější device-first potenciál.