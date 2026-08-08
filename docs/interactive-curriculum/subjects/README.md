# SkillStorm Interactive Curriculum — Subject Blueprints

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy  
> **Last review:** 2026-08-08  
> **Scope:** master index detailních subject blueprintů pro všech 18 vzdělávacích oborů revidovaného RVP ZV.  
> **Purpose:** zajistit, že před vývojem máme pro každý obor stejně přísnou pedagogickou a produktovou specifikaci.

---

## 1. Co tento adresář znamená

Tento adresář je detailní pedagogická vrstva pod:

- `../README.md` — Interactive Curriculum north star,
- `../USE-CASES.md` — master katalog use cases,
- `../SCHOOL-CURRICULUM-COVERAGE.md` — školní ŠVP/coverage pohled,
- `../PRODUCTION-CONTRACT.md` — runtime a production invarianty,
- `../CURRICULUM-DATA-CONTRACT.md` — curriculum/versioning/evidence data contract,
- [`SUBJECT-BLUEPRINT-STANDARD.md`](./SUBJECT-BLUEPRINT-STANDARD.md) — závazná struktura těchto blueprintů.

Blueprinty nejsou státní osnovy. Revidovaný RVP ZV pracuje s očekávanými výsledky učení a škola je rozpracovává do vlastního ŠVP. Ročníkové osy v těchto dokumentech jsou proto **SkillStorm recommended progression** a musí být při produkčním nasazení mapovány na konkrétní curriculum version a ŠVP školy.

Oficiální struktura RVP ZV: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti`.

---

## 2. Pokrytí všech vzdělávacích oblastí a oborů

Revidovaný RVP ZV má deset vzdělávacích oblastí. Tento katalog pokrývá všech osmnáct vzdělávacích oborů.

| Vzdělávací oblast | Vzdělávací obor | SkillStorm blueprint | Primární experience family |
| --- | --- | --- | --- |
| Jazyk a jazyková komunikace | Český jazyk a literatura | [`CZECH-LANGUAGE-LITERATURE.md`](./CZECH-LANGUAGE-LITERATURE.md) | Language, Text & Literature Studio |
| Jazyk a jazyková komunikace | Anglický jazyk | [`ENGLISH.md`](./ENGLISH.md) | English Communication Lab |
| Jazyk a jazyková komunikace | Další cizí jazyk | [`ADDITIONAL-FOREIGN-LANGUAGE.md`](./ADDITIONAL-FOREIGN-LANGUAGE.md) | Language Scenario Engine |
| Matematika a její aplikace | Matematika | [`MATHEMATICS.md`](./MATHEMATICS.md) | Math Manipulative Lab |
| Informatika | Informatika | [`INFORMATICS.md`](./INFORMATICS.md) | Interactive IT Lab |
| Člověk a jeho svět | Člověk a jeho svět | [`HUMAN-AND-WORLD.md`](./HUMAN-AND-WORLD.md) | World Explorer Junior |
| Člověk a společnost | Dějepis | [`HISTORY.md`](./HISTORY.md) | Historical Investigation Lab |
| Člověk a společnost | Výchova k občanství | [`CIVICS.md`](./CIVICS.md) | Civic & Finance Simulation |
| Geografie | Geografie | [`GEOGRAPHY.md`](./GEOGRAPHY.md) | Map Lab |
| Člověk a příroda | Fyzika | [`PHYSICS.md`](./PHYSICS.md) | Physics Lab |
| Člověk a příroda | Chemie | [`CHEMISTRY.md`](./CHEMISTRY.md) | Chem Lab |
| Člověk a příroda | Přírodopis | [`BIOLOGY.md`](./BIOLOGY.md) | BioSystems Lab |
| Umění a kultura | Výtvarná a filmová výchova | [`VISUAL-AND-FILM-EDUCATION.md`](./VISUAL-AND-FILM-EDUCATION.md) | Visual & Media Studio |
| Umění a kultura | Hudební, taneční a dramatická výchova | [`MUSIC-DANCE-DRAMA.md`](./MUSIC-DANCE-DRAMA.md) | Sound & Performance Lab |
| Člověk, zdraví a bezpečí | Výchova ke zdraví a bezpečí | [`HEALTH-AND-SAFETY.md`](./HEALTH-AND-SAFETY.md) | Health & Safety Scenarios |
| Člověk, zdraví a bezpečí | Tělesná výchova | [`PHYSICAL-EDUCATION.md`](./PHYSICAL-EDUCATION.md) | Movement Orchestrator |
| Člověk, jeho osobnost a svět práce | Osobnostní a sociální výchova | [`PERSONAL-SOCIAL-EDUCATION.md`](./PERSONAL-SOCIAL-EDUCATION.md) | Reflection & Collaboration Studio |
| Člověk, jeho osobnost a svět práce | Polytechnická výchova a praktické činnosti | [`POLYTECHNICS-PRACTICAL-ACTIVITIES.md`](./POLYTECHNICS-PRACTICAL-ACTIVITIES.md) | Workshop & Project Engine |

---

## 3. Společná produktová zásada

Jednotlivé předměty **nesmějí být různě obarvené kvízy**.

Každý obor dostává vlastní didaktickou „řeč“:

- český jazyk pracuje s poslechem, textem, interpretací, formulací a argumentací;
- cizí jazyk s komunikací, poslechem, významem a reálnými scénáři;
- matematika s manipulací reprezentací, modelováním a řešením problémů;
- informatika s konstrukcí, daty, algoritmy, systémy a diagnostikou;
- člověk a jeho svět s konkrétní zkušeností dítěte, mapou, přírodou a běžným životem;
- dějepis s pramenem, otázkou, hypotézou a nejistotou;
- občanství s rozhodnutím, pravidlem, rozpočtem, argumentem a trade-offem;
- geografie s mapovými vrstvami, daty a prostorovými vztahy;
- fyzika s měřením, modelem, grafem a experimentem;
- chemie s pozorovatelným jevem, částicovým modelem a symbolickým zápisem;
- přírodopis se systémem organismů, prostředí, funkcí a změn;
- umění s tvorbou a reflexí, ne se správnou jednou odpovědí;
- zdraví s bezpečným rozhodováním a praktickým nácvikem;
- tělesná výchova s reálným pohybem, ne s časem u obrazovky;
- OSV s reflexí, spoluprací a bezpečnou komunikací;
- polytechnika s plánem, materiálem, postupem a skutečnou výrobou.

---

## 4. Reuse mapa engineů

Cílem není osmnáct izolovaných runtime stacků.

```text
Activity / Lesson Experience Kernel
│
├─ Audio & Language capabilities
├─ Text Evidence capabilities
├─ Math Manipulative capabilities
├─ Map capabilities
├─ Timeline / Source capabilities
├─ Simulation capabilities
├─ Build / System capabilities
├─ BioSystems capabilities
├─ Media Composition capabilities
├─ Scenario / Decision capabilities
└─ Movement / Workshop orchestration
```

Jeden engine může sloužit více oborům. Například `MapEngine` využije geografie, dějepis i Člověk a jeho svět; `TextEvidenceEngine` čeština, dějepis i občanství; `Audio` čeština, angličtina, další jazyk i hudebka.

---

## 5. Hardware filozofie

Každý blueprint uvádí doporučené delivery modes, ale poslední slovo má učitel.

- `BOARD_ONLY` — jedna interaktivní tabule/projektor;
- `SHARED_DEVICES` — typicky 4–10 zařízení pro skupiny;
- `DEVICES` — PC učebna nebo 1:1;
- `HYBRID` — board drží společný příběh, zařízení řeší části.

Žádný předmět nesmí být zbytečně nepoužitelný jen proto, že škola nemá 30 tabletů.

---

## 6. Subject readiness stav

Všechny blueprinty v tomto adresáři mají status `VISION / APPROVED`. To znamená:

- produktový a pedagogický směr je schválen jako cíl;
- nejde o tvrzení, že engine už existuje;
- před implementací konkrétního vertical slice se provede OVU/ŠVP mapping a subject-methodology review;
- před produkčním release se použijí gates z [`SUBJECT-BLUEPRINT-STANDARD.md`](./SUBJECT-BLUEPRINT-STANDARD.md) a `../PRODUCTION-CONTRACT.md`.

Každý z 18 blueprintů obsahuje recommended progression, lesson archetypes, konkrétní experience catalog, delivery-mode strategii, teacher orchestration, learning evidence, difficulty × scaffolding, SVP/accessibility, authoring/engine pravidla, safety/privacy/licensing, nejméně dvě hero lessons, MVP vertical slice, non-goals, production acceptance criteria, pilot metrics a content coverage workflow.

---

## 7. Doporučené pořadí realizace

Blueprint completeness neznamená paralelní implementaci všech oborů.

Doporučené pořadí zůstává:

1. Curriculum Foundation + Lesson Experience kernel;
2. Chemie — `BOARD_ONLY` simulation archetype;
3. Informatika — `DEVICES` build/diagnose archetype;
4. Český jazyk/audio — timed audio archetype;
5. Geografie — layered spatial-data archetype;
6. Fyzika, přírodopis, matematika;
7. angličtina a další cizí jazyky;
8. dějepis, občanství;
9. člověk a jeho svět;
10. zdraví/bezpečí, umění, tělesná výchova, OSV, polytechnika.

Toto pořadí může změnit pilotní evidence a potřeba konkrétní školy, ale změna musí být zanesena do `../../roadmap/master.md`.

---

## 8. Definition of Done celé subject vrstvy

```text
[x] existuje standard subject blueprintu
[x] katalog odpovídá 18 vzdělávacím oborům RVP ZV
[x] všech 18 subject blueprintů existuje
[x] každý má recommended progression
[x] každý má lesson archetypes a experience catalog
[x] každý má delivery-mode strategii
[x] každý má learning evidence a accessibility
[x] každý má >= 2 hero lessons
[x] každý má MVP/non-goals/release gates
[x] všechny cesty jsou v docs registry
[ ] Documentation Integrity je zelený na aktuálním HEAD
```

Poslední checkbox se označí pouze podle skutečného GitHub Actions výsledku na stejném HEAD, nikdy anticipovaně.

---

> **Final invariant:** Škola musí být schopná vzít vlastní ŠVP a najít v SkillStormu pedagogicky smysluplný způsob, jak vyučovat každý podporovaný obor — nikoli pouze sadu testů k procvičení po hodině.