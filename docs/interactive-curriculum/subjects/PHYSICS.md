# SkillStorm Subject Blueprint — Fyzika

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy + Physics Review  
> **Last review:** 2026-08-08  
> **Scope:** Fyzika na ZŠ, primárně 2. stupeň; konkrétní pořadí témat určuje ŠVP školy.  
> **Purpose:** production-spec `Physics Lab` — měření, manipulace, model, graf, predikce a diagnostika.

---

## 1. Subject promise

**SkillStorm promění fyzikální vztah z hotového vzorce na pozorovatelný problém, se kterým žák manipuluje, měří ho, modeluje a vysvětluje.**

Základní smyčka:

```text
QUESTION
  ↓
PREDICT
  ↓
MANIPULATE / MEASURE
  ↓
DATA + VISUAL MODEL
  ↓
GRAPH / RELATIONSHIP
  ↓
EXPLAIN
  ↓
NEW CONDITION / DIAGNOSE
```

---

## 2. Kurikulární pozice

Fyzika je vzdělávací obor oblasti `Člověk a příroda`. Blueprint navazuje na témata typu měření, pohyb a síly, energie, zvuk a světlo, elektřina a magnetismus a modely mikro/makrosvěta, ale nepředstírá závaznou ročníkovou osnovu.

Každá produkční Lesson Experience musí být mapována na konkrétní framework release a ŠVP školy.

---

## 3. Pedagogický model

Fyzika má v SkillStormu čtyři reprezentace:

1. **situace / jev** — co se reálně děje;
2. **měření / data** — co lze zjistit;
3. **model / diagram** — jak systém reprezentujeme;
4. **matematický vztah / graf** — jak vztah popíšeme.

Žák nemá vidět graf jako hotovou ilustraci. Graf má vznikat společně s dějem a měřením.

---

## 4. Delivery modes

### `BOARD_ONLY`

Silný pro:

- společné predikce;
- demonstrace pohybu/sil/optiky;
- práci s grafem;
- společné modelování;
- teacher-led virtual experiment.

### `SHARED_DEVICES` — velmi silný

Skupiny mění různé parametry a výsledky se porovnávají na tabuli.

### `DEVICES`

Vhodný pro Circuit Builder, diagnostiku, individualizované experimentální mise a zpracování dat.

### `HYBRID`

Board ukazuje společný model, skupiny/žáci získávají data nebo řeší varianty.

---

## 5. Lesson archetypes

### A. Measure before formula
Nejdřív data, potom vztah.

### B. Predict the graph
Žák nakreslí/volí očekávaný průběh před experimentem.

### C. Manipulate one variable
Řízené zkoumání vlivu jedné veličiny.

### D. Build the system
Elektrický obvod, optická sestava, mechanický systém.

### E. Diagnose failure
Systém nefunguje; žák vytváří hypotézu, měření, opravu.

### F. Compare models
Dva modely vysvětlují stejný jev; žák řeší jejich použitelnost a limity.

### G. Real-world engineering decision
Energetická, konstrukční nebo měřicí volba s trade-offs.

### H. Physical experiment companion
SkillStorm připraví reálný experiment, vede sběr dat a následnou interpretaci.

---

## 6. Recommended progression / experience families

### Measurement foundation

- `Which Tool?` — volba měřidla;
- `Measurement Lab` — přesnost, opakování, odchylka;
- `Estimate First` — odhad před měřením;
- `Unit Sense` — veličina a jednotka v kontextu.

### Motion & forces

- `Motion Lab`;
- `Graph from Motion`;
- `Force Playground`;
- `Friction Challenge`;
- `Balance & Moments` podle ŠVP;
- `Energy Transfer`.

### Electricity & magnetism

- `Circuit Builder`;
- `Measure the Circuit`;
- `Fault Finder`;
- `Magnetic Field Explorer` v didakticky přiměřeném modelu;
- `Energy & Power at Home`.

### Sound & light

- `Wave Viewer`;
- `Sound Lab` s propojením na Audio Engine;
- `Optics Bench`;
- `Shadow Geometry`;
- `Lens Challenge`.

### Macro/micro models

- `Scale Journey`;
- `Model the Invisible`;
- případné astronomické/mikrosvětové modely dle ŠVP s explicitními scale caveats.

---

## 7. Experience catalog

### PHY-01 — Measurement Lab
Žák vybere nástroj, odhadne hodnotu, změří a interpretuje přesnost. Virtuální měření nemá vždy krásnou celočíselnou hodnotu.

### PHY-02 — Motion Lab
Objekt se pohybuje v čase a současně vzniká tabulka a graf. Žák mění parametry a vysvětluje změnu reprezentace.

### PHY-03 — Predict the Graph
Před spuštěním experimentu žák sestaví očekávaný tvar grafu. Po experimentu porovná prediction vs. data.

### PHY-04 — Force Playground
Vektory sil jsou manipulovatelné. Žák sleduje změnu pohybu a musí vysvětlit výsledný efekt.

### PHY-05 — Friction Case
Různé povrchy/podmínky. Úkolem je vytvořit a ověřit hypotézu, ne najít skryté číslo.

### PHY-06 — Circuit Builder
Baterie, vodič, spínač, spotřebič, rezistor a měřidla. Obvod má fyzikálně konzistentní validaci.

### PHY-07 — Circuit Fault Finder
Systém má symptom. Žák nejdřív diagnostikuje pomocí měření, potom opravuje.

### PHY-08 — Energy House
Žák mění izolaci, provozní režim a další schválené parametry domu. Zobrazuje se energie/data, ne jedno ideologické skóre.

### PHY-09 — Power Budget
Domácnost/dílna má omezený příkon. Žák řeší reálné omezení a vysvětluje rozhodnutí.

### PHY-10 — Wave & Sound Viewer
Propojení zvukového vjemu s reprezentací vlny pouze v rozsahu didakticky korektního modelu.

### PHY-11 — Optics Bench
Zrcadla/čočky/paprsky. Manipulace okamžitě mění geometrický model.

### PHY-12 — Shadow Investigation
Zdroj, objekt a stín. Žák předpovídá a následně zdůvodňuje velikost/polohu.

### PHY-13 — Engineering Failure
Vícekroková diagnostika systému. Evidence je hypotéza → měření → revize → oprava.

### PHY-14 — Real Experiment Recorder
SkillStorm nevykresluje simulaci; žák fyzicky měří a zadává data, systém pomáhá zobrazit graf a reflektovat kvalitu měření.

### PHY-15 — Model Limits
Žák porovná zjednodušený model s realitou a určí, co model zanedbává.

---

## 8. Teacher orchestration

Launch panel:

```text
7.A · Fyzika
Téma podle ŠVP: Pohyb
Lesson: Motion Lab — From movement to graph
40 min · BOARD_ONLY / SHARED_DEVICES

[Spustit]
```

Teacher actions:

- `ASK PREDICTION`;
- `RUN / PAUSE / RESET`;
- `LOCK VARIABLE`;
- `SHOW DATA`;
- `SHOW GRAPH`;
- `COMPARE GROUPS`;
- `SHOW MODEL`;
- `PAUSE ALL`;
- `SEND HINT` v device režimu;
- `REFLECTION`.

Teacher nesmí být nucen editovat fyzikální engine parametry, které nejsou součástí schváleného lesson contentu.

---

## 9. Mission Control

V `DEVICES`/`SHARED_DEVICES` režimu učitel vidí pedagogické stavy:

```text
Class: 8.B · Circuit Fault Finder
6 groups active
2 completed
1 group repeatedly replacing bulb without measuring
Common bottleneck: measurement placement
Suggested intervention: demonstrate measurement point
```

Nezobrazuje se „event count“ bez pedagogického významu.

---

## 10. Learning evidence

- estimate/prediction;
- choice of instrument;
- measurement set;
- graph prediction;
- model construction;
- diagnostic hypothesis;
- sequence of relevant tests;
- explanation;
- transfer problem;
- teacher observation.

Completion ≠ understanding.

Příklad evidence:

```text
Motion relationship
- prediction: partial
- measured data: valid
- graph interpretation: correct after hint
- transfer to new motion: independent
```

---

## 11. Difficulty × scaffolding

### Explorer
- jedna proměnná;
- explicitní relevantní měřidla;
- vizuálně vedený model.

### Builder
- volba proměnné/nástroje;
- vlastní měření;
- vysvětlení grafu.

### Technician
- diagnostika závady;
- omezený počet testů;
- práce s neúplnými daty.

### Engineer
- otevřenější systém;
- trade-offs;
- návrh měřicího postupu;
- model limits/nejistota.

---

## 12. Accessibility/SVP

- všechny grafy mají textové/tabulkové alternativy;
- vektory nejsou odlišené jen barvou;
- non-drag ovládání;
- možnost krokovat čas místo realtime animace;
- reduced motion;
- audio instrukce + text;
- jasné jednotky a hodnoty;
- možnost zvýraznit jednu relevantní proměnnou;
- časový tlak defaultně vypnutý;
- keyboard workflow v device mode.

---

## 13. Content authoring

Physics lesson odděluje:

- scene/system definition;
- allowed variables;
- initial conditions;
- measurement instruments;
- simulation rules;
- graph mappings;
- model overlays;
- checkpoint logic;
- evidence;
- teacher notes;
- real-experiment variant;
- curriculum mappings.

Content author nesmí přepisovat core physics rules pomocí libovolného skriptu bez review.

---

## 14. PhysicsLabEngine contract

Capabilities:

- deterministic state simulation;
- variable controls;
- measurement layer;
- synchronized time/data/graph;
- vector overlays;
- circuit graph model;
- optics geometry;
- scenario fault injection;
- run comparison;
- semantic event emission;
- pause/step/reset;
- accessibility representations.

Events:

```text
PREDICTION_SUBMITTED
VARIABLE_CHANGED
MEASUREMENT_TAKEN
GRAPH_PREDICTED
SYSTEM_CONNECTED
FAULT_HYPOTHESIS_SUBMITTED
TEST_PERFORMED
MODEL_VIEWED
EXPLANATION_SUBMITTED
```

---

## 15. Scientific integrity and safety

- model musí mít zdokumentované zjednodušení;
- jednotky a škály musí být konzistentní;
- simulace nesmí „podvádět“ kvůli efektu;
- elektřina nesmí vést k nebezpečným domácím experimentům;
- reálné experimenty musí mít teacher safety notes;
- AI-generated physics content není auto-published;
- claim o energetice/technologii se opírá o explicitní data a assumptions.

---

## 16. Hero lesson A — Pohyb → graf

**Mode:** `BOARD_ONLY` + volitelně `SHARED_DEVICES`  
**Duration:** 45 min

### 0–5 Hook
Animovaná situace: dvě vozidla dojedou do stejného bodu různým způsobem.

> Jak by vypadal graf jejich pohybu?

### 5–10 Prediction
Třída nakreslí/volí průběh bez spuštění dat.

### 10–20 Experiment
Učitel/žák mění rychlost a pauzy. Data se zapisují.

### 20–27 Graph reveal
Graf vzniká ze stejného časového průběhu. Žáci porovnávají prediction.

### 27–35 Group challenge
Skupiny dostanou cílový graf a musí vytvořit pohyb, který by ho mohl generovat.

### 35–42 Transfer
Nový graf bez animace — vysvětli příběh pohybu.

### 42–45 Reflection
Co graf ukazuje a co z něj zjistit nelze?

Evidence: initial graph prediction + created motion + final explanation.

Fallback: připravené tabulky a static graph runs.

---

## 17. Hero lesson B — Najdi závadu v obvodu

**Mode:** `SHARED_DEVICES` / `DEVICES`  
**Duration:** 45 min

### Hook
> Žárovka nesvítí. Máš tři měření. Co změříš jako první?

### Build understanding
Žáci nejdřív označí hypotézu. Teprve potom mohou manipulovat.

### Diagnostics
Každý test něco stojí v „diagnostic budget“ — ne jako gamifikace ceny, ale jako motivace promyslet měření.

### Intervention
Mission Control ukáže, pokud velká část třídy nahodile mění součástky bez měření. Učitel `PAUSE ALL` a ukáže princip diagnostiky.

### Transfer
Nová závada s jiným symptomem.

Evidence:

- first hypothesis;
- first measurement;
- hypothesis revision;
- repair;
- explanation.

---

## 18. MVP vertical slice

První Physics Lab:

**Motion Lab + synchronized graph**

Musí prokázat:

- board manipulation;
- deterministic time simulation;
- data collection;
- synchronized graph;
- prediction-before-reveal;
- compare runs;
- reflection;
- accessible text/table representation.

Circuit Builder může být druhý vertical slice, protože testuje jiný system-builder archetype.

---

## 19. Non-goals

První verze není:

- univerzitní multiphysics solver;
- realtime 3D fyzikální engine pro každý jev;
- CAD;
- náhrada reálných měření;
- systém, který automaticky známkuje kreativní experimentální návrh jedním procentem;
- sběr dat ze senzorů bez jasného curriculum use case;
- virtuální laboratoř, která nikdy neopustí obrazovku.

---

## 20. Production acceptance criteria

```text
[ ] fyzikální model schválil subject reviewer
[ ] assumptions/model limits jsou dokumentované
[ ] jednotky jsou konzistentní
[ ] curriculum mapping prošel review
[ ] prediction není prozrazena simulací před potvrzením
[ ] graph/data synchronization je deterministická
[ ] device state je idempotentní/reconnect-safe
[ ] board controls jsou classroom-readable
[ ] accessibility alternativy existují
[ ] fallback existuje
[ ] semantic telemetry je minimalizovaná
[ ] real-experiment notes řeší safety
[ ] teacher Mission Control zobrazuje pedagogické, ne technické signály
```

---

## 21. Pilot metrics

- time to first prediction;
- prediction→explanation change;
- graph misconception rate;
- teacher intervention count;
- measurement errors;
- random-click vs. planned-test behavior v diagnostic lessons;
- reconnect incidents;
- teacher reuse intent;
- transfer performance;
- accessibility issues.

---

## 22. Cross-curricular reuse

- matematika — grafy, algebraické vztahy, data;
- informatika — sensor/data pipeline, systems diagnostics;
- chemie — měření, energie, modely;
- geografie — klima/energie/data;
- polytechnika — elektrické obvody, materiály, měření;
- hudebka — zvuk;
- člověk a jeho svět — měření a běžné jevy na 1. stupni.

---

## 23. Content coverage workflow

```text
School physics topic
→ OVU/aspects
→ choose archetype
→ determine if simulation / real experiment / hybrid is best
→ author lesson
→ physics review
→ accessibility review
→ curriculum mapping approval
→ pilot
→ publish
```

Ne každý OVU musí mít virtuální simulaci. Pokud je lepší reálné měření s digitálním záznamem a reflexí, to je správný SkillStorm use case.

---

> **Final invariant:** Physics Lab má způsobit, že žák dokáže propojit jev, měření, model a vysvětlení. Pokud pouze kliká do hotového diagramu a vybírá vzorec, engine neplní svou roli.