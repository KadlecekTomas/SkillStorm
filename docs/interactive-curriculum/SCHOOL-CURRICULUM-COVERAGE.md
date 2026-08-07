# SkillStorm — School Curriculum Coverage & ŠVP Integration

> **Status:** product, curriculum & architecture blueprint  
> **Scope:** celá ZŠ; mapování SkillStormu na RVP ZV 2025 a konkrétní ŠVP školy  
> **Parent docs:** [Interactive Curriculum](./README.md) · [Master Use Cases](./USE-CASES.md) · [Audio & Language Engine](./AUDIO-LANGUAGE-ENGINE.md)  
> **Last review:** 2026-08-07  
> **Core rule:** škola nemá hledat „co v SkillStormu máme“. SkillStorm má po načtení ŠVP ukázat **co přesně může škola použít pro svůj vlastní vzdělávací plán, v daném ročníku, předmětu a období**.

---

## 0. Proč tento dokument existuje

Samotná knihovna interaktivních aktivit nestačí.

Škola používá vlastní **Školní vzdělávací program (ŠVP)**. Ten může:

- používat jiné názvy předmětů,
- rozdělit stejné RVP výsledky do jiných ročníků,
- některé obory integrovat,
- některá témata posunout v čase,
- využívat disponibilní časovou dotaci jinak,
- mít vlastní školní OVU, tematické celky a projekty.

Proto SkillStorm nesmí být svázán s představou:

```text
7. třída -> Přírodopis -> Buňka
```

jako jedinou pravdou.

Správný model je:

```text
RVP / závazné OVU
        ↓
ŠVP konkrétní školy
        ↓
školní předmět / integrovaný předmět
        ↓
ročník + školní OVU + tematický celek
        ↓
SkillStorm Lesson Experience
        ↓
Learning Evidence
```

Tento dokument definuje:

1. celkovou mapu vzdělávacích oblastí ZŠ,
2. doporučený SkillStorm experience model pro každou oblast,
3. způsob napojení na ŠVP školy,
4. pravidla curriculum versioningu během přechodu na revidovaný RVP ZV,
5. coverage model `COVERED / PARTIAL / MISSING`,
6. data model a workflow pro školu, učitele a content team.

---

# 1. Oficiální rámec RVP ZV 2025

Revidovaný RVP ZV pracuje s deseti vzdělávacími oblastmi:

| Kód | Vzdělávací oblast | Vzdělávací obory |
| --- | --- | --- |
| `JJK` | Jazyk a jazyková komunikace | Český jazyk a literatura, Anglický jazyk, Další cizí jazyk |
| `MAT` | Matematika a její aplikace | Matematika |
| `INF` | Informatika | Informatika |
| `CJS` | Člověk a jeho svět | Člověk a jeho svět |
| `CAS` | Člověk a společnost | Dějepis, Výchova k občanství |
| `GEO` | Geografie | Geografie |
| `CAP` | Člověk a příroda | Fyzika, Chemie, Přírodopis |
| `UAK` | Umění a kultura | Výtvarná a filmová výchova, Hudební, taneční a dramatická výchova |
| `CZB` | Člověk, zdraví a bezpečí | Výchova ke zdraví a bezpečí, Tělesná výchova |
| `CSP` | Člověk, jeho osobnost a svět práce | Osobnostní a sociální výchova, Polytechnická výchova a praktické činnosti |

K tomu SkillStorm musí umět mapovat také:

- klíčové kompetence,
- základní gramotnosti,
- průřezová témata,
- školní OVU,
- lokální tematické celky,
- projekty a mezipředmětové vazby.

### Klíčové kompetence

- k učení,
- komunikační,
- osobnostní a sociální,
- k občanství a udržitelnosti,
- k podnikavosti a pracovní,
- k řešení problémů,
- kulturní,
- digitální.

### Základní gramotnosti

- čtenářská a pisatelská,
- logicko-matematická.

### Průřezová témata

- Péče o sebe a druhé,
- Společnost pro všechny,
- Udržitelné prostředí.

---

# 2. Kritická produktová zásada: RVP != ŠVP != předmět v rozvrhu

SkillStorm musí odlišovat tři vrstvy.

## 2.1 RVP

Centrální závazný rámec.

Obsahuje například OVU a jejich kódy.

## 2.2 ŠVP školy

Škola si RVP rozpracuje do vlastní struktury.

Může mít například:

```text
RVP obory:
Fyzika + Chemie + Přírodopis

ŠVP školy:
Přírodní vědy
```

nebo:

```text
Člověk a jeho svět
↓
1.–3. ročník: Prvouka
4.–5. ročník: Vlastivěda + Přírodověda
```

SkillStorm nesmí tyto názvy předpokládat.

## 2.3 SkillStorm content

Lesson Experience se váže primárně na:

- jeden či více OVU,
- doporučený věk / ročník,
- postupný krok k OVU,
- learning evidence.

A teprve přes mapovací vrstvu se zobrazí jako obsah pro konkrétní školní předmět.

---

# 3. Přechodné období: SkillStorm musí podporovat více curriculum verzí

V roce 2026 nelze produkt postavit pouze na předpokladu, že všechny školy již používají revidovaný RVP ZV.

SkillStorm proto potřebuje curriculum versioning.

```text
CurriculumFramework
├── CZ_RVP_ZV_LEGACY
├── CZ_RVP_ZV_2025
└── future versions
```

Škola při onboardingu nastaví:

```text
Používaný ŠVP:
● současný ŠVP podle staršího RVP
○ nový ŠVP podle RVP ZV 2025
○ přechodný režim
```

### Přechodný režim

Škola může mít například:

```text
1. a 6. ročník -> nový ŠVP
ostatní       -> předchozí ŠVP
```

SkillStorm proto nesmí mít jedno globální pole `curriculumVersion` na organizaci.

Potřebuje curriculum profile s platností podle:

- školního roku,
- stupně,
- ročníku,
- případně třídy.

---

# 4. Celková mapa předmětů a SkillStorm experiences

Tato kapitola není seznam všech budoucích aktivit. Je to **coverage mapa**, která říká, jaký druh produktu má pro jednotlivé obory největší pedagogickou hodnotu.

---

# 5. Jazyk a jazyková komunikace

## 5.1 Český jazyk a literatura

### SkillStorm role

**Language Studio + Audio Learning + Text Lab + Media Lab**

### Primární delivery

- `BOARD_ONLY`
- `SHARED_DEVICES`
- `DEVICES`
- `HYBRID`

### Experience families

- fonologické a sluchové rozlišování,
- čtení s porozuměním,
- práce se strukturou věty,
- slovní zásoba a význam,
- manipulace s textem,
- argumentace,
- mediální gramotnost,
- literatura a interpretace,
- mluvený projev,
- psaní a redakční workflow.

### Hero experiences

- `MÁ–MA Audio Lab`,
- Větný parser,
- Poslechový detektiv,
- Text pod mikroskopem,
- Argument Clinic,
- Media Voice,
- Rhetoric Lab,
- Redakce.

### Learning evidence

Ne pouze „správně/špatně“, ale například:

- rozlišil zvukový jev,
- porozuměl významu textu,
- identifikoval manipulaci,
- formuloval tvrzení a argument,
- upravil text podle komunikační situace,
- vytvořil vlastní sdělení.

Detail: [Audio & Language Engine](./AUDIO-LANGUAGE-ENGINE.md).

---

## 5.2 Anglický jazyk

RVP explicitně strukturuje obor na:

- recepci,
- produkci,
- interakci,
- mediaci.

To je pro SkillStorm velmi silný produktový kontrakt.

### SkillStorm role

**Language Mission Studio**

Ne `vocabulary quiz`, ale situace.

### Experiences

- poslouchej letištní hlášení a reaguj,
- objednej v restauraci,
- zeptej se na cestu,
- vysvětli spolužákovi informaci z jiného zdroje,
- vyřeš skupinovou misi pouze v angličtině,
- poslech různých mluvčích,
- vizuální slovní zásoba v kontextu,
- dialogue branching.

### Hero lesson

`Lost in the City`

```text
MAP
↓
AUDIO INSTRUCTION
↓
student asks / interprets
↓
team decides route
↓
communication evidence
```

### Důležité

AI může pomáhat s generováním variant dialogu, ale hodnocení výslovnosti nesmí být tvrdé nebo stigmatizující.

---

## 5.3 Další cizí jazyk

Použije stejný Language Engine, ale:

- vlastní kurátorované audio assety,
- vlastní jazykový profil,
- vlastní úroveň obtížnosti,
- vlastní curriculum mapping.

Engine je společný, obsah nikoli.

---

# 6. Matematika a její aplikace

Oficiální tematická struktura zahrnuje:

- číslo a početní operace,
- měření a výpočty,
- geometrii v rovině a prostoru,
- statistiku a pravděpodobnost,
- algebru.

### SkillStorm role

**Math Manipulative Engine**

Matematiku nesmíme digitalizovat jako nekonečný generátor příkladů.

Má vizualizovat a manipulovat s tím, co je na papíru abstraktní.

### Experiences

#### 1. stupeň

- Number World,
- manipulace s množstvím,
- rozklad čísel,
- Fraction Lab,
- peníze a obchod,
- měření skutečných objektů,
- geoboard,
- stavba tvarů,
- práce s tabulkou a grafem.

#### 2. stupeň

- Algebra Tiles,
- Function Machine,
- Geometry Construction Lab,
- Scale & Map Mission,
- Probability Simulator,
- Data Room,
- rozpočty a reálné modelování.

### Primary modes

- `BOARD_ONLY` pro společné modelování,
- `DEVICES` pro individuální exploraci,
- `SHARED_DEVICES` pro skupinové problémové mise.

### Learning evidence

- model vytvořený žákem,
- strategie řešení,
- změna reprezentace,
- odhad vs. výsledek,
- argumentace proč řešení funguje.

---

# 7. Informatika

Oficiální okruhy:

- data, informace a modelování,
- algoritmizace a programování,
- informační systémy,
- digitální technologie.

### SkillStorm role

**Interactive IT Lab**

### Experience families

- data lab,
- algoritmické puzzle,
- coding sandbox,
- information system builder,
- Build a PC,
- Network Builder,
- Cyber Incident,
- Diagnose the System.

### Primary mode

`DEVICES` / `HYBRID`

### Killer feature

Teacher Mission Control:

> kdo je zaseknutý, kde, jak dlouho a na jakém konceptu.

Detail: [Interactive IT Lab](../interactive-it-lab/README.md).

---

# 8. Člověk a jeho svět — 1. stupeň

RVP pracuje s tématy:

- Místo, kde žijeme,
- Lidé kolem nás,
- Lidé a čas,
- Rozmanitost přírody,
- Člověk, jeho zdraví a bezpečí,
- Lidé a svět financí.

Tady je velká produktová příležitost, protože jde přirozeně o integrovanou výuku.

### SkillStorm role

**World Explorer Junior**

### Experiences

- moje cesta do školy,
- bezpečná křižovatka,
- živá mapa okolí,
- moje obec,
- časová osa rodiny / obce,
- roční období a počasí,
- školní zahrada,
- třídní hlasování,
- malý obchod,
- rodinný rozpočet junior,
- třídění odpadu,
- ekosystém okolí školy.

### Primary mode

`BOARD_ONLY` / `HYBRID`

### Zásada

SkillStorm má dítě posílat **ven do světa**, ne uzavírat do tabletu.

Například:

```text
SkillStorm zadá misi
↓
třída jde ven měřit / pozorovat
↓
data se vrátí do SkillStormu
↓
společná vizualizace
↓
reflexe
```

---

# 9. Člověk a společnost

## 9.1 Dějepis

RVP staví na historickém myšlení a aktivní práci se zdroji.

### SkillStorm role

**History Investigation Lab**

### Experiences

- Source Detective,
- Who Can We Trust?,
- Timeline Builder,
- archeologická vrstva,
- Historical Map Lab,
- perspektivy různých aktérů,
- příčina → důsledek,
- rekonstrukce události z pramenů,
- Media Then & Now.

### Co nesmíme dělat

`Kdy byla bitva X? A/B/C/D`

jako hlavní model dějepisu.

### Learning evidence

- práce s pramenem,
- rozpoznání perspektivy,
- formulace vysvětlení,
- práce s časem,
- doložení tvrzení zdrojem.

---

## 9.2 Výchova k občanství

Oficiální tematické okruhy:

- Já ve společnosti,
- Odpovědný občan,
- Já a svět financí.

### SkillStorm role

**Civic & Decision Simulation Engine**

### Experiences

- obecní zastupitelstvo,
- třídní referendum,
- konflikt hodnot,
- práce se stereotypem,
- Fake / Manipulation Feed,
- domácí rozpočet,
- banka a úvěr,
- tvorba ceny,
- rodinná finanční krize,
- smlouvy a rozhodování,
- veřejný rozpočet.

### Primary mode

`BOARD_ONLY` / `SHARED_DEVICES`

### Zásada

Systém nesmí rozhodnout politický nebo hodnotový spor za žáka.

Má:

- zobrazit důsledky,
- vyžadovat argument,
- pracovat s fakty,
- umožnit porovnat varianty.

---

# 10. Geografie

RVP má čtyři silné okruhy:

- Geografie a její metody poznávání,
- Přírodní a socioekonomické prostředí a jejich interakce,
- Místa a regiony světa,
- Udržitelnost života na Zemi.

Navíc explicitně pracuje s mapami, geografickými daty a geoinformačními technologiemi.

### SkillStorm role

**Geography Map Lab**

### Experience families

- mapové vrstvy,
- GIS-lite,
- práce s daty,
- klima,
- hydrologie,
- reliéf,
- sídla,
- migrace,
- hospodářství,
- globalizace,
- konflikty v geografickém kontextu,
- region comparison,
- sustainability planning.

### Hero experiences

- Climate Layers,
- Build a Sustainable City,
- Flood Response,
- Migration Explorer,
- Railway Planner,
- Energy Mix,
- Why Here?,
- Media Map of the World.

### Primary mode

`BOARD_ONLY` / `HYBRID`

Interaktivní tabule je zde přirozeně obrovská pracovní mapa.

---

# 11. Člověk a příroda

## 11.1 Fyzika

Oficiální okruhy:

- vlastnosti látek a měření veličin,
- pohyb, síly a energie,
- zvuk a světlo,
- elektřina a magnetismus,
- mikrosvět a makrosvět.

### SkillStorm role

**Physics Lab**

### Experiences

- Measurement Lab,
- Motion Lab,
- Force Playground,
- Energy Transfer,
- Circuit Builder,
- Magnetism Field Lab,
- Optics Bench,
- Sound Lab,
- Astronomy Scale Explorer.

### Pattern

```text
PREDICT
↓
MANIPULATE
↓
MEASURE
↓
OBSERVE
↓
MODEL
↓
EXPLAIN
```

### Důležité

Virtuální experiment **nemá plošně nahrazovat reálný experiment**.

Používáme ho, když:

- je jev neviditelný,
- experiment je nebezpečný,
- vybavení není dostupné,
- chceme rychle měnit parametry,
- potřebujeme připravit nebo reflektovat reálný pokus.

---

## 11.2 Chemie

Oficiální okruhy:

- Chemie a já,
- Chemie a planeta Země,
- Chemie a společnost.

RVP zdůrazňuje praktické vědecké dovednosti, propojení pozorovaného jevu s částicovým světem, bezpečnost a udržitelné myšlení.

### SkillStorm role

**Chem Lab**

### Experiences

- Laboratory Safety,
- Particle World,
- Separation Lab,
- pH / Neutralization,
- Food Chemistry,
- Household Chemistry,
- Air Quality Data Lab,
- Water Cycle Chemistry,
- Soil & Materials,
- Reaction Model Builder.

### Primary mode

`BOARD_ONLY`

sekundárně:

- `SHARED_DEVICES`,
- `HYBRID`,
- `DEVICES`.

### Grafický standard

Digitální laboratorní stůl, ne testová kartička.

---

## 11.3 Přírodopis

Oficiální okruhy:

- Živé struktury a jejich funkce,
- Organismy a prostředí,
- Rozmnožování a dědičnost,
- Evoluce a rozmanitost,
- Dynamická planeta.

### SkillStorm role

**Biology Systems Explorer**

### Experiences

- Cell Builder,
- Organ Systems,
- Ecosystem Web,
- Food Web Simulation,
- Evolution Tree,
- Adaptation Challenge,
- Genetics Lab,
- Biodiversity Survey,
- Dynamic Earth,
- Field Observation Missions.

### Zásada

Živé organismy nesmí být redukovány na drag & drop popisků.

Těžiště:

- vztahy,
- systémy,
- procesy,
- pozorování,
- evidence,
- modelování.

---

# 12. Umění a kultura

## 12.1 Výtvarná a filmová výchova

Oficiální osa:

- vlastní tvorba a její sdílení,
- recepce a reflexe uměleckého díla,
- kulturní povědomí a jednání.

### SkillStorm role

**Creative Studio + Visual Story Lab**

### Experiences

- Composition Lab,
- Color & Contrast,
- Visual Story,
- Shot Builder,
- Storyboard Studio,
- Poster / propaganda comparison,
- Visual Culture Detective,
- Film Editing Concepts,
- gallery reflection.

### Zásada

SkillStorm **nenahrazuje kreslení, malbu, fotoaparát ani fyzickou tvorbu**.

Má:

- připravit úkol,
- demonstrovat princip,
- umožnit experiment bez ztráty materiálu,
- usnadnit reflexi a sdílení.

---

## 12.2 Hudební, taneční a dramatická výchova

Oficiální osa:

- interpretace, vlastní tvorba a sdílení,
- recepce a reflexe,
- kulturní povědomí a jednání.

### SkillStorm role

**Sound & Performance Lab**

### Experiences

- Rhythm Lab,
- melody / pitch exploration,
- instrument identification,
- Arrangement Lab,
- sound layers,
- movement sequence builder,
- dramatic scene branching,
- character motivation,
- performance reflection.

### Důležité

Digitální systém nemá děti učit hudbu tak, že budou 45 minut klikat.

Správná smyčka:

```text
SkillStorm model / zadání
↓
skutečná hudba / pohyb / drama
↓
SkillStorm reflexe / evidence
```

---

# 13. Člověk, zdraví a bezpečí

## 13.1 Výchova ke zdraví a bezpečí

Oficiální okruhy zahrnují:

- ochranu a podporu zdraví,
- denní režim,
- osobní bezpečí,
- bezpečí při mimořádných událostech a v souvislosti s obranou státu.

### SkillStorm role

**Health & Safety Scenario Engine**

### Experiences

- první pomoc scénář,
- infekce / prevence decision tree,
- denní režim,
- výživa a pohyb,
- online safety,
- consent & boundaries age-appropriate scenarios,
- krizová situace,
- evakuace,
- emergency decision simulation.

### Zásada

Citlivá témata:

- bez veřejného individuálního skóre,
- bez zesměšnění,
- bez neověřené AI diagnostiky,
- teacher-controlled reveal,
- jasná evidence sources / metodické validity.

---

## 13.2 Tělesná výchova

RVP zdůrazňuje pohybovou gramotnost a skutečný pohyb.

### SkillStorm role

**Movement Orchestrator**, ne fitness app.

### Experiences

- station rotation,
- tactical board,
- movement challenge cards,
- reaction / coordination games,
- personal progress reflection,
- warm-up generator,
- team strategy.

### Rule

> Pokud je žák kvůli SkillStormu místo pohybu déle na obrazovce, produkt selhal.

---

# 14. Člověk, jeho osobnost a svět práce

## 14.1 Osobnostní a sociální výchova

Oficiální okruhy:

- osobnostní rozvoj,
- sociální a etický rozvoj,
- kariérový rozvoj.

### SkillStorm role

**Reflection & Scenario Studio**

### Experiences

- conflict resolution,
- team decision scenarios,
- communication styles,
- self-reflection,
- learning strategy reflection,
- career interest exploration,
- portfolio,
- project retrospectives.

### Privacy

Tady je nutný nejvyšší stupeň opatrnosti.

Citlivé sebereflexe nesmí být automaticky:

- veřejné,
- klasifikované,
- používány pro ranking,
- dostupné mimo oprávněné osoby.

---

## 14.2 Polytechnická výchova a praktické činnosti

Oficiální okruhy:

- práce s technickým materiálem a technická tvořivost,
- péče o domácnost a zahradu,
- konstrukční činnosti a automatizace.

### SkillStorm role

**Workshop & Project Engine**

### Experiences

- Workshop Planner,
- Material Lab,
- Build Before You Build,
- measure → plan → cut,
- Repair Don't Replace,
- Garden Planner,
- Home Maintenance,
- Simple Automation,
- Sensor Project,
- Tiny House Project.

### Správný pattern

```text
DIGITAL PLAN
↓
REAL BUILD
↓
MEASURE RESULT
↓
REFLECT
```

---

# 15. Cross-curricular experiences

Nejvyšší využití SkillStormu nevznikne vždy uvnitř jednoho předmětu.

### Sustainable School

- geografie,
- matematika,
- fyzika,
- občanství,
- informatika,
- udržitelnost.

### School Garden

- Člověk a jeho svět,
- přírodopis,
- matematika,
- polytechnika.

### Plan a School Trip

- geografie,
- matematika,
- cizí jazyk,
- finance.

### Information Crisis

- český jazyk,
- informatika,
- občanství,
- dějepis.

### Disaster Response

- geografie,
- fyzika,
- zdraví a bezpečí,
- občanství.

### Build a Tiny House

- matematika,
- fyzika,
- polytechnika,
- výtvarná výchova,
- finance.

---

# 16. Jak se SkillStorm reálně přizpůsobí ŠVP školy

## 16.1 Onboarding školy

Ředitel / curriculum admin:

```text
1. Zvolí školní rok
2. Zvolí curriculum framework
3. Nahraje / vytvoří strukturu ŠVP
4. Definuje předměty školy
5. Namapuje školní OVU / tematické celky
6. Potvrdí návrhy vazeb SkillStormu
```

### Důležité

AI může **navrhnout mapping**.

AI nesmí sama definitivně prohlásit:

> „tato aktivita naplňuje tento školní OVU“

bez možnosti lidské kontroly.

---

# 17. Doporučený import ŠVP

## Phase 1 — spolehlivý model

Preferovat strukturovaný import:

- Excel,
- CSV,
- guided editor.

Šablona:

| Pole | Příklad |
| --- | --- |
| School subject | Přírodní vědy |
| Grade | 7 |
| Period / unit | Září–říjen |
| School outcome | Vysvětlí vztah mezi... |
| RVP OVU | CAP-... |
| Topic | Ekosystém |
| Hours | 8 |

## Phase 2

Asistovaný import z DOCX/PDF:

- extrakce,
- návrh struktury,
- lidská validace.

Nikdy ne „upload PDF → systém automaticky tvrdí, že pochopil ŠVP na 100 %“.

---

# 18. Teacher UX: `Můj ŠVP`

Učitel nemá začínat v globální knihovně.

Jeho domovská obrazovka může být:

```text
7.B · Přírodní vědy

Aktuální tematický celek:
Ekosystémy

ŠVP progress
███████████░░░  68 %

Doporučené Lesson Experiences

[ Ecosystem Web ]
25 min · BOARD_ONLY · 2 OVU

[ Pond Investigation ]
45 min · HYBRID · field activity

[ Food Web Challenge ]
20 min · SHARED_DEVICES
```

Tím SkillStorm přestává být katalog.

Stává se **výukovým operačním systémem konkrétní školy**.

---

# 19. `Curriculum Coverage` dashboard pro školu

Ředitel nebo koordinátor vidí:

```text
RVP / ŠVP COVERAGE 2028/29

Český jazyk          ████████████  91 %
Matematika            ██████████░░  84 %
Informatika           ███████████░  88 %
Člověk a jeho svět    █████████░░░  73 %
Dějepis               ████████░░░░  66 %
Občanství             ███████░░░░░  61 %
Geografie             ██████████░░  82 %
Fyzika                ████████░░░░  68 %
Chemie                █████████░░░  75 %
Přírodopis            █████████░░░  74 %
...
```

Ale procento nesmí být marketingová metrika.

Musí být odvozené z explicitního coverage modelu.

---

# 20. Coverage status

Každý OVU / school outcome:

```text
COVERED
PARTIAL
MISSING
NOT_APPLICABLE
REVIEW_REQUIRED
```

### `COVERED`

Existuje alespoň jedna pedagogicky validovaná Lesson Experience, která vytváří odpovídající learning evidence.

### `PARTIAL`

Aktivita pokrývá jen část požadavku.

### `MISSING`

Obsah chybí.

### `REVIEW_REQUIRED`

Automatický návrh mapování existuje, ale pedagog jej ještě nepotvrdil.

---

# 21. Learning evidence je součást curriculum mappingu

Nestačí:

```text
Activity -> OVU
```

Potřebujeme:

```text
Activity
↓
Checkpoint
↓
Evidence type
↓
OVU aspect
```

Například:

```text
GEO Climate Lab

OVU:
využívá mapy a geografická data...

Evidence:
- selected relevant layers
- interpreted climate data
- explained regional difference
- transferred reasoning to new location
```

Teprve tak lze mluvit o skutečném pokrytí.

---

# 22. Doporučený data model

Názvy jsou pracovní.

```text
CurriculumFramework
- id
- countryCode
- code
- version
- validFrom
- validTo

CurriculumArea
- frameworkId
- code
- name

CurriculumField
- areaId
- code
- name

CurriculumOutcome
- fieldId
- code
- nodeGrade
- text
- metadata

SchoolCurriculum
- organizationId
- frameworkId
- academicYearId
- name
- status

SchoolSubject
- schoolCurriculumId
- name
- code

SchoolCurriculumUnit
- schoolSubjectId
- grade
- order
- title
- schoolOutcomeText
- plannedPeriod

SchoolOutcomeMapping
- schoolCurriculumUnitId
- curriculumOutcomeId
- status
- confidence
- approvedBy

ActivityCurriculumMapping
- activityVersionId
- curriculumOutcomeId
- coverage
- evidenceSpec
- reviewedBy
- reviewedAt
```

---

# 23. Content publishing gate

Produkční Lesson Experience nemá být označena jako curriculum-aligned, dokud nemá:

- cílový věk / ročník,
- curriculum framework,
- explicitní OVU mapping,
- learning evidence,
- pedagogickou revizi,
- accessibility review,
- supportované delivery modes.

---

# 24. ŠVP-aware search

Globální knihovna může obsahovat desetitisíce aktivit.

Učitel však primárně uvidí:

```text
PRO MŮJ ŠVP
```

Filtry:

- můj předmět,
- můj ročník,
- moje aktuální téma,
- můj školní OVU,
- délka hodiny,
- dostupný hardware,
- obtížnost,
- accessibility,
- delivery mode.

---

# 25. Hardware-aware curriculum recommendation

Příklad:

Škola má:

- interaktivní tabuli,
- 6 tabletů,
- žádné 1:1 zařízení.

SkillStorm stejné ŠVP téma doporučí jako:

```text
Chemie
→ BOARD_ONLY Chem Lab

Geografie
→ BOARD_ONLY Map Lab

Matematika
→ SHARED_DEVICES station rotation

Český jazyk
→ BOARD_ONLY Audio Lab

Informatika
→ naplánovat do PC učebny
```

Curriculum alignment a hardware orchestrace se tím propojí.

---

# 26. ŠVP změna nesmí rozbít historii

ŠVP se mění.

Proto výsledky žáků musí vždy odkazovat na **snapshot / verzi curriculum mappingu**, která platila v době výuky.

Nikdy nepřepisovat historické výsledky novým mappingem potichu.

---

# 27. Integrované předměty jsou first-class

SkillStorm nesmí předpokládat, že každá škola má samostatně:

```text
Fyziku
Chemii
Přírodopis
```

Pokud má škola:

> **Příroda a technologie**

může obsahovat vazby na:

- CAP/FYZ,
- CAP/CHE,
- CAP/PRI,
- INF,
- CSP polytechniku.

Teacher experience stále funguje přes školní předmět.

Content engine stále používá canonical curriculum mapping.

---

# 28. Ročník je doporučení + školní rozhodnutí

Lesson Experience má:

```text
recommendedGrades: [7, 8]
```

Ale škola ji může používat v 6. ročníku, pokud její ŠVP daný školní OVU skutečně obsahuje.

SkillStorm upozorní:

> Tato aktivita je doporučena pro 7.–8. ročník. Ve vašem ŠVP je daný výsledek zařazen v 6. ročníku. Aktivitu lze použít; doporučujeme vyšší scaffolding.

To je správná adaptace na ŠVP.

---

# 29. Coverage priority pro vývoj

Ne všechny chybějící aktivity mají stejnou hodnotu.

Priorita:

```text
OVU importance
× number of schools / grades
× current coverage gap
× reuse across subjects
× interactive advantage
÷ development cost
```

Tak vzniká backlog s reálným ROI.

---

# 30. Doporučené pořadí subject blueprints

## Tier 1 — největší interactive advantage

1. Informatika
2. Chemie
3. Geografie
4. Fyzika
5. Matematika
6. Český jazyk / Audio & Language

## Tier 2

7. Přírodopis
8. Angličtina
9. Dějepis
10. Občanství / finance
11. Člověk a jeho svět

## Tier 3

12. Polytechnika
13. Zdraví a bezpečí
14. Umění a kultura
15. OSV
16. Tělesná výchova

Tier neznamená pedagogickou důležitost.

Znamená doporučené **pořadí vývoje digitální interaktivní vrstvy** podle pravděpodobného product ROI.

---

# 31. Co musí být hotovo, aby škola řekla „SkillStorm sedí na náš ŠVP“

Minimální kontrakt:

- škola má curriculum profile,
- školní předměty lze pojmenovat libovolně,
- školní předmět lze mapovat na více RVP oborů,
- školní OVU lze mapovat na canonical OVU,
- učitel vidí obsah podle svého ŠVP,
- lesson experience ukazuje, které školní cíle podporuje,
- výsledky ukládají learning evidence,
- ředitel vidí `covered / partial / missing`,
- mapping je verzovaný,
- AI mapping vyžaduje lidskou validaci,
- systém podporuje souběh starého a revidovaného RVP během přechodného období.

---

# 32. Co NEZNAMENÁ „pokrytí ŠVP“

Nesmíme tvrdit coverage jen proto, že:

- máme PDF k tématu,
- máme kvíz se stejným názvem,
- activity má tag `chemie`,
- AI našla podobné věty,
- jeden OVU je připojený k 20 aktivitám bez důkazu učení.

Skutečné curriculum coverage znamená:

> **Aktivita umožňuje žákovi prokázat relevantní část očekávaného výsledku a systém ví, jaký důkaz o učení vznikl.**

---

# 33. Strategický závěr

SkillStorm nemá být pouze:

> nejlepší interaktivní knihovna pro školy.

Cílový produkt je silnější:

> **SkillStorm je curriculum-aware výuková platforma, která překládá ŠVP konkrétní školy do reálných Lesson Experiences, pomáhá učiteli odučit je dostupným hardwarem a průběžně ukazuje, co žáci skutečně prokázali.**

To vytváří tři úrovně hodnoty:

### Pro učitele

> Co mám tento týden učit a jak to udělám dobře?

### Pro vedení školy

> Opravdu naše výuka pokrývá náš ŠVP a máme k tomu evidence?

### Pro SkillStorm

> Které curriculum gaps mají nejvyšší hodnotu k dalšímu vývoji?

---

# 34. Next implementation documents

Po tomto dokumentu mají následovat:

1. `RVP-COVERAGE.md` — exhaustive canonical OVU matrix,
2. machine-readable RVP dataset / sync,
3. `CHEM-LAB.md`,
4. `GEOGRAPHY-MAP-LAB.md`,
5. `MATH-LAB.md`,
6. `PHYSICS-LAB.md`,
7. School Curriculum / ŠVP data model ADR,
8. ŠVP import specification,
9. Curriculum Coverage dashboard spec.

---

## Final doctrine

> **RVP definuje společný cíl. ŠVP definuje cestu konkrétní školy. SkillStorm nesmí školu nutit měnit tuto cestu — musí se na ni inteligentně napojit a dodat lepší výukové zážitky, orchestrace a důkazy o učení.**
