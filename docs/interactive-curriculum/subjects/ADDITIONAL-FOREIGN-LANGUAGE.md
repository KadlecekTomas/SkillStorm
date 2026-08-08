# SkillStorm Subject Blueprint — Další cizí jazyk

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy + Foreign Language Review  
> **Last review:** 2026-08-08  
> **Scope:** Další cizí jazyk na ZŠ; konkrétní jazyk, zahájení a ročníkové uspořádání určuje ŠVP školy.  
> **Purpose:** production-spec reusable `Language Scenario Engine` pro němčinu, španělštinu, francouzštinu a další školní jazyky bez hardcodování jednoho jazyka.

---

## 1. Subject promise

**SkillStorm má druhý cizí jazyk co nejrychleji převést z „učím se seznam slov“ do malých funkčních situací, kde žák rozumí, reaguje, ptá se a opravuje nedorozumění.**

Centrální model je stejný jako u angličtiny, ale produkt musí počítat s tím, že žák obvykle začíná později a má méně hodin.

```text
CONTEXT
→ NOTICE SOUND/MEANING
→ USE SMALL LANGUAGE CHUNK
→ INTERACT
→ REPAIR
→ REUSE IN NEW CONTEXT
```

---

## 2. Kurikulární pozice

Další cizí jazyk je samostatný obor oblasti `Jazyk a jazyková komunikace`. SkillStorm nesmí předpokládat konkrétní jazyk ani konkrétní učebnici.

Produkční language pack musí mít:

- `languageCode`;
- locale/variant metadata;
- reference audio;
- accepted variation;
- content rights;
- curriculum mappings;
- school-specific sequence.

---

## 3. Pedagogický model

Protože časová dotace může být menší, je důležitá vysoká funkčnost každé aktivity:

- porozumět krátkému sdělení;
- použít omezenou slovní zásobu smysluplně;
- opakovat jazyk v několika kontextech;
- překonat strach z mluvení;
- využívat podobnosti/rozdíly s češtinou a angličtinou vědomě, ne mechanicky.

---

## 4. Delivery modes

- `BOARD_ONLY` — nový input, společný poslech, dialog demo;
- `SHARED_DEVICES` — dvojice/skupiny, role-play;
- `DEVICES` — individuální poslech/čtení/psaní;
- `HYBRID` — doporučený pro komunikační lekce.

Mikrofon není povinný.

---

## 5. Lesson archetypes

1. `First Contact`
2. `Listen & Select`
3. `Mini Information Gap`
4. `Ask for Something`
5. `Find / Buy / Order`
6. `Introduce / Describe`
7. `Plan Together`
8. `Read a Sign / Menu / Timetable`
9. `Dialogue Repair`
10. `Pronunciation Notice`
11. `Culture in Situation`
12. `Build a Functional Message`

---

## 6. Recommended progression

### Starter band
- greetings/identity;
- classroom language;
- numbers/time/basic personal information;
- sound system;
- simple needs and questions;
- picture/audio-driven comprehension.

### Developing band
- town/travel/food/school/leisure;
- short reading for purpose;
- role-play;
- basic description/narrative;
- short functional writing;
- repair strategies.

### Consolidation band
- more autonomous interaction;
- plans/preferences/reasons;
- simple comparison;
- short presentation;
- mediation/reformulation;
- culture/context.

Pásma nejsou ročníky a škola je mapuje podle ŠVP.

---

## 7. Experience catalog

### FL2-01 — Hello Mission
Board představí postavy a situace; žák volí/produkuje přiměřený pozdrav a reakci.

### FL2-02 — Sound Map
Reference audio ukazuje zvuky/rytmy nového jazyka. Cílem je noticing, ne známka z akcentu.

### FL2-03 — Classroom Survival
Krátké fráze typu žádost o zopakování, nerozumění, základní instrukce.

### FL2-04 — Number / Time Mission
Čísla a čas jsou vložené do reálné situace, ne izolovaný drill.

### FL2-05 — Mini Market
Žák musí něco najít/objednat/zjistit cenu v kurátorované situaci.

### FL2-06 — Café Dialogue
Krátký dialog s cílem, změnou objednávky a role swap.

### FL2-07 — Find the Place
Mapa + jednoduché instrukce.

### FL2-08 — Train / Bus Info
Čas, směr, nástupiště/stanice v přiměřeném rozsahu.

### FL2-09 — Information Gap Pair
Každý má jinou část informací; mluvení je nutné k dokončení úkolu.

### FL2-10 — Describe & Identify
Jeden popisuje, druhý identifikuje; systém neposkytuje celý answer set oběma.

### FL2-11 — Short Message
Napiš funkční zprávu s konkrétním účelem a recipient context.

### FL2-12 — Dialogue Repair
Nedorozumění → zopakuj/přeformuluj/zeptej se.

### FL2-13 — Culture Card in Context
Reálný sociální/komunikační kontext bez stereotypů.

### FL2-14 — Weekend Plan
Dvojice domluví jednoduchý plán s omezením času/ceny/počasí.

### FL2-15 — Mini Presentation
Krátké strukturované představení tématu bez požadavku na memorovaný text.

### FL2-16 — Cross-language Detective
Žák si všímá podobných slov/struktur a zároveň falešných přátel v kurátorovaném rozsahu.

---

## 8. Teacher orchestration

```text
8.A · Německý jazyk
Lesson: Café Dialogue
35 min · HYBRID
Pairs: yes
Reference audio: curated
Recording: OFF

[Spustit]
```

Teacher actions:

- `PLAY / SLOW / REPLAY`;
- `SHOW PHRASE SUPPORT`;
- `PAIR / ROLE SWAP`;
- `HIDE SUPPORT`;
- `ADD COMPLICATION`;
- `PAUSE ALL`;
- `REFLECTION`.

---

## 9. Learning evidence

- listening comprehension;
- phrase used in correct function;
- interaction goal achieved;
- repair strategy;
- short written message;
- reading information selection;
- teacher observation;
- revision after feedback.

Neukládá se „accent score“ jako dlouhodobý profil.

---

## 10. Difficulty × scaffolding

### Explorer
- reference phrase;
- visual support;
- slow audio;
- limited choices.

### Builder
- partial support;
- pair interaction;
- own sentence.

### Technician
- unexpected change;
- less familiar input;
- repair/rephrase.

### Engineer
- more open interaction;
- mediation;
- short independent presentation/writing.

---

## 11. Accessibility/SVP

- transcript/captions;
- replay without penalty;
- extra response time;
- text/audio alternatives;
- optional oral output where accommodation requires;
- no speed competition;
- no public pronunciation score;
- clear role cards;
- simplified instructions;
- keyboard navigation.

---

## 12. Content authoring and language packs

Každý jazyk je datový/content pack nad společným enginem:

```text
LanguagePack
├─ language/locale
├─ reference speakers
├─ audio assets + transcript
├─ pronunciation notes
├─ accepted variants
├─ lexicon/functions by lesson
├─ cultural/context notes
├─ scripts
├─ rights/provenance
└─ curriculum mappings
```

Renderer nesmí obsahovat hardcoded německé/španělské/francouzské gramatické předpoklady.

---

## 13. Engine contract

Reuse:

- Audio & Language Engine;
- Dialogue Scenario;
- Text/Message Builder;
- pair information-gap;
- optional MapEngine;
- timed media.

Semantic events:

```text
AUDIO_REPLAYED
PHRASE_SUPPORT_OPENED
ROLE_STARTED
INTERACTION_GOAL_REACHED
REPAIR_STRATEGY_USED
MESSAGE_REVISED
ROLE_SWAPPED
```

---

## 14. Linguistic/cultural integrity

- každé referenční audio reviewované pro daný jazyk;
- locale/variant explicitní;
- legitimní varianty nejsou označeny jako chyba jen proto, že answer key zná jednu;
- cultural examples nejsou stereotypní dekorace;
- generativní dialogue musí mít vocabulary/age/safety constraints;
- AI translation není náhrada student production;
- child voice retention off by default.

---

## 15. Hero lesson A — Café Mission

**Mode:** `HYBRID`  
**Duration:** 40 min

### Hook
Board zobrazí jednoduché menu a krátký audio model.

### Notice
Žáci identifikují funkční fráze.

### Pair role-play
Jeden objednává, druhý obsluhuje. Každý má role card.

### Complication
Jedna položka není dostupná. Žáci musí upravit komunikaci.

### Role swap
Role se vymění.

### Reflection
Které fráze pomohly udržet komunikaci, když něco nešlo podle plánu?

Evidence: task completion + repair strategy + teacher observation.

---

## 16. Hero lesson B — Najdi správný spoj

**Mode:** `SHARED_DEVICES`  
**Duration:** 45 min

Žáci mají jednoduchý jízdní řád, audio announcement a cílový čas.

Musí:

- pochopit klíčovou informaci;
- najít vhodný spoj;
- vysvětlit ho partnerovi;
- reagovat na změnu.

Jedna lesson kombinuje listening, reading a speaking bez potřeby velkého slovníku.

---

## 17. MVP vertical slice

**Café Mission** jako language-agnostic template + první konkrétní jazykový pack.

MVP prokazuje:

- content pack separation;
- audio/transcript;
- role distribution;
- pair task;
- repair branch;
- no required recording;
- accessibility.

---

## 18. Non-goals

- samostatný nový runtime engine pro každý jazyk;
- slovíčkový streak jako hlavní produkt;
- public accent leaderboard;
- překladač;
- chatbot bez curriculum goal;
- hardcoded grammar progression společná všem školám;
- permanentní voice profile.

---

## 19. Production acceptance criteria

```text
[ ] language reviewer approved pack
[ ] curriculum mapping reviewed
[ ] audio transcript + rights complete
[ ] locale/variant explicit
[ ] accepted variants modeled
[ ] no mandatory voice storage
[ ] role information gap cannot leak
[ ] accessibility works
[ ] cultural context reviewed
[ ] language pack does not require renderer code fork
```

---

## 20. Pilot metrics

- actual speaking/interaction time;
- listening comprehension;
- support usage over repeated lessons;
- repair strategies;
- teacher intervention;
- privacy/accessibility incidents;
- teacher reuse;
- portability of same template to a second language pack.

---

## 21. Cross-curricular reuse

- angličtina — shared engine;
- čeština — audio/communication;
- geografie — travel/map contexts;
- OSV — dialogue/collaboration;
- umění — culture/media.

---

## 22. Content coverage workflow

```text
School foreign-language outcome
→ language + level + ŠVP
→ communicative purpose
→ shared template or new lesson archetype
→ author language pack content
→ native/qualified language review
→ rights/culture/accessibility review
→ mapping approval
→ pilot
→ publish
```

---

> **Final invariant:** Další cizí jazyk musí reuse společný Language Engine a současně respektovat specifika konkrétního jazyka. Platforma nemá vyrábět osamocené slovíčkové drill aplikace pro každý jazyk zvlášť.