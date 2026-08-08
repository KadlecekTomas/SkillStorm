# SkillStorm — Subject Blueprint Standard

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Pedagogy + Engineering  
> **Last review:** 2026-08-08  
> **Scope:** závazná struktura a Definition of Done pro všechny subject blueprinty Interactive Curriculum.  
> **Authority:** doplňuje `../PRODUCTION-CONTRACT.md` a `../CURRICULUM-DATA-CONTRACT.md`; při konfliktu mají normativní contracts vyšší precedence.

---

## 1. Proč standard existuje

SkillStorm nesmí mít jeden perfektní předmět a patnáct vágních kapitol. Každý vzdělávací obor musí být před implementací popsán dostatečně přesně na to, aby produkt, pedagog, designér, content tým i engineering rozuměli stejné cílové zkušenosti.

Subject blueprint proto není marketingový text ani seznam her. Je to pedagogicko-produktová specifikace, která odpovídá minimálně na tyto otázky:

1. Co se má žák naučit a jaký typ činnosti je pro obor přirozený?
2. Jak se liší doporučená zkušenost podle věku, ročníku a konkrétního ŠVP?
3. Co dělá žák, co dělá učitel a co dělá SkillStorm?
4. Jaká interakce je didakticky lepší než prezentace, PDF nebo kvíz?
5. Jaká learning evidence vzniká?
6. Jak aktivita funguje při jedné tabuli, několika sdílených zařízeních i 1:1 režimu?
7. Jaké accessibility/SVP varianty musí existovat bez stigmatizace?
8. Jaké jsou bezpečnostní, privacy, licensing a odborné limity?
9. Jaký engine nebo interaction primitives jsou potřeba?
10. Co je MVP a co už je zbytečně drahý nebo pedagogicky slabý scope?

---

## 2. Kurikulární kontrakt

Revidovaný RVP ZV vymezuje vzdělávací oblasti a vzdělávací obory a očekávané výsledky učení zejména v uzlových bodech. Konkrétní ročníkové rozložení vytváří škola ve svém ŠVP.

Proto platí:

- subject blueprint smí navrhnout **SkillStorm recommended progression**;
- recommended progression není státní ročníková osnova;
- produkční Lesson Experience musí být mapovaná přes curriculum data model na konkrétní verzi frameworku a případně ŠVP školy;
- žádný blueprint nesmí tvrdit `RVP complete` bez aspect-level coverage auditu;
- změna upstream RVP/ŠVP mappingu nesmí zpětně změnit historický význam evidence;
- integrovaný školní předmět smí kombinovat více oborů; SkillStorm se proto neupíná na název předmětu v rozvrhu.

Oficiální referenční zdroj pro aktuální RVP ZV je portál NPI `https://prohlednout.rvp.cz/zakladni-vzdelavani/`.

---

## 3. Povinná struktura každého subject blueprintu

Každý blueprint musí obsahovat:

1. **Subject promise** — jedna věta, co SkillStorm v oboru mění.
2. **Pedagogický model** — co je přirozenou činností oboru.
3. **Recommended progression** — věkové/ročníkové pásmo, nikoli falešná osnova.
4. **Lesson archetypes** — opakovatelné typy hodin.
5. **Experience catalog** — konkrétní Lesson Experiences.
6. **Delivery modes** — `BOARD_ONLY`, `SHARED_DEVICES`, `DEVICES`, `HYBRID`.
7. **Teacher orchestration** — launch, pause, intervention, reflection.
8. **Learning evidence** — co se ukládá a co naopak ne.
9. **Difficulty × scaffolding** — oddělené osy.
10. **Accessibility/SVP** — alternativy k drag-only, audio-only, color-only apod.
11. **Content authoring** — co je parametrizovatelné bez zásahu programátora.
12. **Engine contract** — potřebná reusable primitiva a subject-specific capability.
13. **Safety/privacy/licensing** — oborově specifická rizika.
14. **Hero lessons** — minimálně dvě úplné ukázkové hodiny.
15. **MVP vertical slice** — nejmenší důkaz, že engine opravdu funguje.
16. **Non-goals** — co záměrně nestavíme.
17. **Production acceptance criteria** — měřitelné release gates.
18. **Pilot metrics** — co sledujeme v reálné třídě.
19. **Cross-curricular links** — co může reuse jiný předmět.
20. **Content coverage workflow** — jak se z blueprintu stane skutečný ŠVP coverage.

---

## 4. Společná Lesson Experience kostra

Subject blueprint může strukturu měnit, ale defaultní smyčka je:

```text
HOOK
  ↓
PREDICTION / INITIAL MODEL
  ↓
EXPLORATION / CONSTRUCTION / ANALYSIS
  ↓
DISCOVERY
  ↓
TEACHER INTERVENTION
  ↓
TRANSFER CHALLENGE
  ↓
REFLECTION / EXPLANATION
  ↓
LEARNING EVIDENCE
```

Interaktivita není povinná v každém kroku. Je-li nejlepší část hodiny reálný pokus, diskuze, čtení, pohyb nebo fyzická tvorba, SkillStorm má tuto činnost připravit a následně reflektovat, ne ji nahradit obrazovkou.

---

## 5. Povinné delivery mode otázky

### `BOARD_ONLY`

Blueprint musí říct:

- co je na tabuli čitelné zezadu třídy;
- kdo manipuluje a jak se zapojuje zbytek třídy;
- jak učitel zadává agregované odpovědi bez identifikace dítěte;
- jak aktivita pokračuje při výpadku individuálních zařízení;
- zda je identita žáků vůbec nutná.

### `SHARED_DEVICES`

Blueprint musí říct:

- jak se tvoří skupiny;
- zda evidence patří skupině nebo jednotlivci;
- jak se řeší role ve skupině;
- jak se výsledky skládají na tabuli;
- jak se předchází tomu, aby jeden žák ovládal zařízení za všechny.

### `DEVICES`

Blueprint musí říct:

- co vykresluje klient lokálně;
- jaké semantic events posílá;
- co vidí Mission Control;
- jak funguje reconnect/retry/idempotency;
- co může učitel měnit během rozpracované aktivity.

### `HYBRID`

Blueprint musí explicitně oddělit:

- společnou board narrative;
- individuální/skupinové úkoly;
- agregaci výsledků;
- teacher intervention loop.

---

## 6. Learning Evidence contract

Výchozí evidence může obsahovat:

- první predikci;
- vytvořený model;
- významné rozhodnutí;
- zvolenou strategii;
- měření;
- diagnostickou hypotézu;
- použitou nápovědu;
- revizi odpovědi;
- finální vysvětlení;
- transfer do nového problému;
- reflexi;
- teacher observation.

Bez explicitního důvodu se nesbírá:

- raw pointer stream;
- video obrazovky;
- permanentní audio/video dítěte;
- biometrika;
- každá mikropauza nebo každý klik;
- veřejný performance ranking.

`completion`, `coverage`, `evidence` a `mastery` jsou různé pojmy.

---

## 7. Difficulty a scaffolding

Každý blueprint pracuje se dvěma nezávislými osami.

### Cognitive challenge

Doporučené názvy:

- `EXPLORER` — rozpoznání a řízené objevování;
- `BUILDER` — funkční aplikace principu;
- `TECHNICIAN` — výběr, porovnání, diagnostika;
- `ENGINEER` — komplexní problém, trade-off, otevřenější řešení.

Tyto názvy jsou produktová metadata, ne veřejné nálepky schopnosti dítěte.

### Scaffolding

- `GUIDED`
- `ASSISTED`
- `INDEPENDENT`

Příklady podpory:

- postupné odkrytí;
- audio instrukce;
- vizuální zvýraznění relevantních prvků;
- omezení rušivých možností;
- nápověda po konkrétní chybě;
- alternativní reprezentace;
- více času;
- non-drag varianta.

---

## 8. Accessibility/SVP gate

Každý blueprint musí minimálně řešit:

- ovládání klávesnicí tam, kde je individuální zařízení;
- `tap-select → tap-target` alternativu k drag & drop;
- dostatečné hit targets pro tabuli;
- žádnou informaci pouze barvou;
- žádnou zásadní informaci pouze zvukem;
- transcript/caption pro audio/video;
- reduced motion;
- zoom/reflow;
- jednoduchý jazyk/scaffolded instrukci;
- možnost vypnout časový tlak, pokud čas není samotným cílem;
- soukromí citlivých odpovědí;
- možnost teacher override bez veřejného označení žáka.

---

## 9. Content authoring contract

Obsah nesmí být hardcoded v rendereru. Subject engine musí dovolovat authoring minimálně těchto vrstev:

```text
LessonExperience
├─ metadata
├─ curriculum mappings
├─ recommended/supported delivery modes
├─ narrative / mission
├─ stages
├─ activity definitions
├─ assets
├─ engine configuration
├─ evidence rules
├─ scaffolding variants
├─ teacher notes
├─ safety notes
├─ offline/fallback variant
└─ rights/provenance
```

Lokální škola smí vytvořit organization-scoped variantu bez změny globálního originálu.

---

## 10. Engine reuse rule

Nový subject blueprint **nesmí automaticky navrhnout nový engine**.

Nejdřív se skládá z common primitives:

`SELECT`, `MATCH`, `SORT`, `ORDER`, `HOTSPOT`, `CONNECT`, `DRAW`, `MEASURE`, `MANIPULATE`, `SIMULATE`, `PREDICT`, `COMPARE`, `BUILD`, `DIAGNOSE`, `TIMELINE`, `MAP_LAYER`, `LABEL`, `DIALOGUE`, `AUDIO`, `COLLABORATIVE_DECISION`, `REFLECT`.

Subject-specific engine vzniká jen tehdy, pokud společná primitiva neumí bezpečně a udržitelně vyjádřit centrální didaktickou potřebu oboru.

---

## 11. Safety, privacy a odborná revize

Každý blueprint musí určit, kdo musí schválit obsah před publikací.

Typické role:

- subject-methodology reviewer;
- practicing teacher;
- accessibility reviewer;
- privacy/security reviewer;
- případně odborník na bezpečnost, zdraví nebo laboratorní praxi.

Generativní AI smí připravovat návrhy, ale nesmí bez review publikovat:

- normativní curriculum mapping;
- zdravotní nebo bezpečnostní instrukci;
- laboratorní postup s reálným rizikem;
- historickou interpretaci prezentovanou jako fakt bez provenance;
- právní/občanské tvrzení s normativním dopadem;
- referenční výslovnost určenou k fonetické výuce.

---

## 12. Hero lesson minimum

Každý hero lesson popisuje:

- věkový/ročníkový rozsah;
- výchozí hardware;
- dobu;
- pedagogický cíl;
- hook;
- aktivní kroky po 5–10 minutách;
- teacher intervention point;
- transfer challenge;
- reflection;
- evidence;
- fallback;
- accessibility variantu;
- důvod, proč je digitální forma lepší než prezentace.

---

## 13. MVP pravidlo

MVP subject engine nemá dokazovat šířku katalogu. Má dokazovat jednu celou kvalitní hodinu.

MVP je připravené, pokud:

```text
[ ] má konkrétní curriculum mapping nebo validovatelný mapping draft
[ ] učitel ji spustí bez developerské pomoci
[ ] funguje v deklarovaném hardware režimu
[ ] má reconnect/fallback odpovídající riziku
[ ] má accessibility alternativy
[ ] nesbírá nadbytečná data
[ ] teacher pozná, zda třída koncept pochopila
[ ] evidence není pouze completion score
[ ] content reviewer schválil správnost
[ ] pilot lze vyhodnotit
```

---

## 14. Production acceptance criteria

Subject vertical slice není production-ready jen proto, že „vypadá dobře“.

Povinné gates:

- pedagogická správnost;
- curriculum mapping review;
- content rights/provenance;
- tenant isolation;
- RBAC;
- accessibility;
- deterministic reconnect/retry tam, kde vzniká stav;
- žádný solution leak;
- performance na školním hardware;
- teacher usability;
- anonymní board privacy;
- explicitní data retention pro citlivý obsah;
- fallback a incident behavior;
- observability bez ukládání citlivého raw obsahu.

---

## 15. Pilot metrics

Minimálně:

- teacher setup time;
- time to first meaningful student action;
- technical interruption rate;
- completion/participation;
- bottleneck stages;
- hint usage;
- teacher interventions;
- evidence quality;
- pre/post nebo transfer evidence tam, kde je vhodná;
- teacher willingness to reuse;
- student comprehension/usability feedback;
- accessibility issues;
- hardware/browser incidents.

---

## 16. Definition of Done blueprintu

Subject blueprint je připraven jako podklad vývoje pouze pokud:

```text
[ ] odpovídá tomuto standardu
[ ] nepředstírá ročníkovou osnovu RVP
[ ] navazuje na Production Contract
[ ] navazuje na Curriculum Data Contract
[ ] obsahuje recommended progression
[ ] obsahuje lesson archetypes
[ ] obsahuje konkrétní experience catalog
[ ] definuje všechny relevantní delivery modes
[ ] definuje learning evidence
[ ] definuje SVP/accessibility
[ ] definuje safety/privacy/licensing
[ ] definuje engine reuse
[ ] obsahuje >= 2 hero lessons
[ ] obsahuje MVP + non-goals
[ ] obsahuje production acceptance criteria
[ ] obsahuje pilot metrics
[ ] je registrován v docs/README.md
[ ] `npm run docs:validate` prochází
```

---

> **Final invariant:** Subject blueprint nesmí být seznam efektních funkcí. Musí být dostatečně přesný na to, aby z něj vznikla konzistentní Lesson Experience, která má pedagogický smysl, funguje v reálné české škole a vytváří důkaz o učení bez zbytečného sběru dat.