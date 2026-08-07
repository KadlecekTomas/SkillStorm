# SkillStorm — Master Roadmap

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Engineering  
> **Last review:** 2026-08-07  
> **Authority:** jediný source of truth pro pořadí velkých produktových a architektonických kroků. Při konfliktu s dílčí roadmapou platí tento dokument; security/privacy invarianty a normativní production/data contracts mají vyšší precedence podle [`../README.md`](../README.md).

---

# 0. Produktová severka

SkillStorm je **curriculum-aware classroom experience platform**.

Primární produktová smyčka:

```text
RVP / ŠVP školy
      ↓
co má tato třída skutečně učit
      ↓
Lesson Experience
      ↓
BOARD_ONLY / SHARED_DEVICES / DEVICES / HYBRID
      ↓
činnost žáků + řízení učitelem
      ↓
Learning Evidence
      ↓
plán další výuky
```

School workflow, analytika, importy, RBAC, family space, obsahová knihovna a administrativa tuto smyčku podporují. Nejsou samostatnou konkurenční produktovou severkou.

Původní `Eduto Doctrine` je zachován pouze jako historická strategická teze; jeho status je `SUPERSEDED` v [`../README.md`](../README.md).

---

# 1. Neporušitelné principy

1. **Jedna velká implementační vertikála naráz.** Foundations mohou mít vlastní izolované PR, ale nesmí vzniknout pět nedokončených subject engines současně.
2. **Dokumentace před kódem.** Pokud blueprint, data contract a production contract nejsou konzistentní, vývoj vertikály nezačne.
3. **Teacher-first.** Učitel musí být schopný připravenou hodinu spustit v několika jasných krocích bez znalosti interní architektury.
4. **Hardware je constraint, ne předpoklad.** Platforma musí být hodnotná i ve škole s jednou interaktivní tabulí a několika sdílenými zařízeními.
5. **Difficulty != scaffolding.** Podpora žáka nesmí automaticky znamenat nižší vzdělávací cíl.
6. **Žádné veřejné srovnávání dětí podle výkonu.** Board nepoužíváme k veřejnému označování slabších žáků.
7. **Learning evidence != completion.** Dokončení aktivity není automaticky mastery.
8. **Curriculum mapping je reviewovaný a verzovaný.** AI může navrhnout, ne schválit normativní mapping.
9. **Security a tenant isolation jsou serverové invarianty.** Žádný nový engine nemá paralelní zkratkovitý auth model.
10. **Pilot validuje produkt, ne legalizuje špatnou architekturu.** Produkční gate se neobchází argumentem „zatím jen pilot“.

---

# 2. Současný baseline, který se nesmí regresně rozbít

Repozitář už obsahuje významnou platformní základnu. Před každou foundation změnou se aktuální stav ověří proti `main`, schématu a testům; tento přehled je orientační produktová baseline, nikoli náhrada git historie.

### Platform foundation

- multi-tenant organizace, membership a RBAC,
- studenti, učitelé, třídy, školní struktura,
- obsahová taxonomie a globální/lokální obsah,
- testy, otázky, assignments, submissions/responses,
- import/export workflow,
- analytické a progress základy,
- audit/security/hardening infrastruktura,
- Docker/CI/Playwright testovací základ.

### Classroom foundation

- `BOARD_ONLY` Live Sessions / Bleskovky,
- quiz voting,
- dotykové `MATCH_PAIRS`, `ORDER`, `SORT_BINS`,
- board-safe solution/reveal kontrakty,
- věkové board režimy,
- ClassParták participation XP invarianty.

### Identity/family foundation

Repo obsahuje multi-role/guardian směry a související bezpečnostní práci. Jejich aktuální implementační stav se vždy ověřuje z `main` a příslušných current contracts; nový Interactive Curriculum je nesmí obcházet.

---

# 3. Definition of Ready před startem nového vývoje

Nová velká vertikála může začít pouze pokud:

```text
[ ] relevantní blueprint existuje
[ ] Production Contract nemá otevřený rozpor
[ ] Curriculum Data Contract pokrývá potřebné vazby
[ ] acceptance criteria jsou explicitní
[ ] privacy/security data flow je známý
[ ] accessibility approach je známý
[ ] asset/data provenance strategy je známá
[ ] migration/backward compatibility je známá
[ ] test strategy je známá
[ ] STOP checkpointy jsou definované
```

---

# 4. Fáze D0 — Documentation Hardening & Architecture Freeze

**Stav:** `IN REVIEW` — PR #36.

Cíl: před prvním novým curriculum-engine kódem vytvořit jednoznačné specifikace a odstranit konkurenční source of truth.

Výstupy:

- Documentation Registry,
- Interactive Curriculum vision,
- Master Use Cases 1.–9.,
- School Curriculum Coverage & ŠVP Integration,
- Audio & Language Engine,
- Interactive IT Lab,
- Production Contract,
- Curriculum Data Contract,
- aktualizovaný root README,
- aktualizovaný Master Roadmap,
- klasifikace historických dokumentů.

### D0 exit gate

```text
[ ] docs cross-review bez blocker contradiction
[ ] žádný active source of truth nepoužívá Eduto jako aktuální brand
[ ] žádný current setup návod neobsahuje lokální absolutní cesty/demo secrets
[ ] CURRENT vs VISION jednoznačné
[ ] curriculum versioning konzistentní
[ ] coverage semantics konzistentní
[ ] WCAG/privacy/security/realtime contracts konzistentní
[ ] markdown/link/document validator zelený
[ ] required CI zelené
[ ] PR mergnutý do main
```

**Dokud D0 není splněno, nezačíná D1.**

---

# 5. Fáze D1 — Curriculum Foundation

**Cíl:** SkillStorm poprvé přesně ví, podle jakého framework/ŠVP scope se konkrétní třída v konkrétním školním roce učí.

Normativní dokument:

[`../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)

## D1.1 Framework source model

Implementovat:

- `CurriculumFramework`,
- immutable `CurriculumFrameworkRelease`,
- areas/fields/outcomes,
- source provenance/checksum,
- import dry-run + diff,
- verified release workflow.

### STOP D1-A

Review DB migration, immutability a provenance **před** school-specific mappingy.

## D1.2 School curriculum model

Implementovat:

- `SchoolCurriculumProfile`,
- immutable published `SchoolCurriculumVersion`,
- `SchoolSubject`,
- `SchoolOutcome`,
- `CurriculumApplicability`,
- transition resolver per academic year/grade/class.

### STOP D1-B

Povinné testy:

- legacy + new curriculum současně v jedné škole,
- class-specific override,
- ambiguous applicability = explicit error,
- tenant isolation.

## D1.3 Mapping workflow

- school outcome ↔ canonical outcome/aspect,
- `PROPOSED / APPROVED / REJECTED / STALE`,
- AI návrh bez auto-approval,
- review provenance,
- stale detection při změně source.

### D1 exit gate

Teacher/admin může pro konkrétní class + academic year jednoznačně resolve publikované ŠVP a dohledat jeho původ.

---

# 6. Fáze D2 — Lesson Experience & Classroom Orchestration Kernel

**Cíl:** vytvořit reusable runtime, ne první hardcoded hru.

Implementovat generické doménové základy:

- `Activity` / `ActivityVersion` nebo výsledný ekvivalent odsouhlasený proti aktuálnímu Prisma schema,
- Lesson Experience metadata,
- supported/recommended delivery modes,
- stages/checkpoints,
- semantic event envelope + idempotency,
- live session participant state,
- teacher commands,
- reconnect/resume,
- learning evidence primitives,
- engine registry/capability model,
- asset manifest/preload.

### Klíčový invariant

Současné Bleskovky zůstávají funkční. Komplexní Activity Engine se **nenacpe do `Test/Question`** jen proto, že Live Sessions tuto starší obsahovou cestu používají.

### STOP D2-A — schema

Před migration:

- porovnat proti aktuálnímu `schema.prisma`,
- eliminovat duplicitní LiveSession/participant koncepty,
- migration plan pro současné board sessions,
- tenant/RBAC review.

### STOP D2-B — realtime

Povinný test:

```text
30 simulated participants
→ semantic events
→ reconnect/retry
→ no duplicate evidence
→ teacher pause/resume
→ session finish
```

### D2 exit gate

Jedna minimální interní test activity musí projít všemi čtyřmi relevantními orchestration vrstvami bez subject-specific hacku.

---

# 7. Fáze D3 — Vertical Slice 1: Chem Lab / BOARD_ONLY-first

**Proč první:** ověří nejdostupnější český školní hardware model — učitel + jedna interaktivní tabule — a zároveň subject engine s reálnou simulací, predikcí, měřením a vysvětlením.

MVP lesson:

> **pH / neutralizace — Predict → Experiment → Particle View → New Challenge → Reflection**

Scope:

- board-first renderer,
- teacher orchestration,
- bezpečné virtuální experimenty,
- particle/macro views,
- curated lesson content,
- curriculum mappings,
- evidence bez individualizace v čistém `BOARD_ONLY` režimu,
- fallback při renderer/network failure.

Non-goals MVP:

- kompletní laboratorní software,
- reálné nebezpečné návody,
- stovky chemikálií,
- AI generování experimentů bez review.

### D3 exit gate

Pilotní učitel zvládne lekci spustit a odučit bez developerské pomoci; lesson přežije běžný restart/reconnect a pedagogický reviewer potvrdí, že interaktivita přináší hodnotu nad prezentaci.

---

# 8. Fáze D4 — Vertical Slice 2: Interactive IT Lab / DEVICES-first

**Cíl:** otestovat opačný classroom extrém — individuální zařízení, per-student semantic telemetry a Teacher Mission Control.

MVP:

> **Build a PC**

Scope:

- motherboard + CPU + cooler + RAM + SSD + GPU + PSU + basic cabling + power-on,
- 2.5D renderer,
- generic/SkillStorm assets bez cizích brand práv,
- deterministic compatibility rules,
- Explorer / Builder / Technician progression,
- scaffolding oddělený od difficulty,
- Mission Control,
- teacher pause/resume/help,
- semantic event telemetry,
- learning evidence,
- keyboard/tap alternative k drag interaction.

Non-goals:

- kompletní PC Building Simulator,
- thermal paste physics,
- every screw,
- water cooling,
- real retail catalog bez vyřešených data/licensing práv.

### D4 exit gate

Celá reálná třída zvládne activity flow; učitel identifikuje misconception cluster bez běhání naslepo mezi monitory; žádné pointer/frame streaming.

---

# 9. Fáze D5 — Audio Foundation + Czech Grade 1 Hero Slice

MVP:

> **MÁ | MA — slyším → vidím strukturu → rozlišuji → skládám**

Scope:

- curated human reference audio,
- normal/slow variants,
- timed segments/highlight,
- `PLAY_AUDIO`, `PLAY_SEGMENTED_AUDIO`, `LISTEN_AND_SELECT`, `LISTEN_AND_BUILD`,
- board-first UX,
- transcript/accessibility semantics,
- no required microphone,
- asset rights/provenance.

### STOP D5-A

Lingvistický + pedagogický review audio asset pipeline před masovou výrobou nahrávek.

### D5 exit gate

Prvostupňový učitel zvládne activity použít na tabuli bez žákovských zařízení a audio timing je deterministicky reprodukovatelný.

---

# 10. Fáze D6 — Geography Map Lab

MVP má prokázat:

- velkou board mapu,
- vrstvy,
- měření/trasy,
- datové provenance/licence,
- scenario decision,
- Explain → Evidence vazbu.

Hero case:

> klima / oceánské proudy / reliéf — proč mají regiony na podobné zeměpisné šířce rozdílné klima?

Map Lab se nesmí stát poznávačkou států jako hlavním produktem.

---

# 11. Fáze D7 — Physics / Biology / Math Engines

Po ověření tří různých runtime archetypů:

- simulation board (`Chem`),
- device build (`IT`),
- audio/timed media (`ČJ`),
- layered spatial data (`GEO`),

otevřít další engines postupně:

1. Physics Lab,
2. Biology Explorer / Ecosystem Simulator,
3. Math Manipulative Lab.

Každý engine má vlastní blueprint **před kódem** a musí reuse existující primitives místo paralelního orchestration stacku.

---

# 12. Fáze D8 — Humanities, Languages, Health, Arts, Polytechnics

Postupně:

- Historical Investigation / Source Lab,
- Civic & Finance Simulation,
- Language Studio 2. stupně + cizí jazyky,
- Health & Safety scenarios,
- Creative/Media Studio,
- Sound/Performance extensions,
- Workshop/Project Engine,
- PE orchestration s minimem screen time.

Digitál nesmí vytlačit skutečnou řeč, pohyb, tvorbu, experiment nebo dílnu tam, kde je fyzická činnost samotným cílem.

---

# 13. Fáze D9 — Exhaustive Curriculum Coverage

Teprve po ověření reusable engines systematicky uzavírat coverage gaps.

Proces:

```text
framework release
→ all relevant outcomes/aspects
→ approved mappings
→ coverage matrix
→ MISSING/PARTIAL ranking
→ reusable engine fit
→ content production
→ pedagogical validation
→ coverage review
```

Vývoj se prioritizuje podle:

- curricular importance,
- school demand,
- reuse across grades/subjects,
- current `MISSING/PARTIAL`,
- implementation cost,
- classroom evidence.

Nikoli podle „co by byla cool další hra“.

---

# 14. Průběžné platformní lanes

Tyto práce mohou běžet jako menší izolované hardening PR, ale nesmí rozbít single-major-vertical pravidlo.

## Security / privacy

- RBAC/tenant regression,
- audit logs,
- rate limiting,
- secret handling,
- child-data minimization,
- privacy review pro nové telemetry typy.

## Reliability / ops

- backup + restore drills,
- monitoring/alerting,
- query performance,
- production deployment hardening,
- browser/device support matrix.

## Accessibility

- WCAG 2.2 AA baseline,
- keyboard/touch alternatives,
- reduced motion,
- screen reader sanity checks,
- accommodation profiles.

## Family / guardian

Guardian/family funkcionalita zůstává důležitá. Její práce se plánuje tak, aby neblokovala curriculum kernel a aby nikdy neobcházela jeho identity/privacy contracts.

## Content operations

- authoring validation,
- review workflow,
- asset provenance,
- localization,
- versioning.

---

# 15. Pilot strategy

Pilot není jednorázová událost před veškerým vývojem. Každá velká experience family má vlastní pilotní gate.

Standard pilotu:

```text
1 interní lesson
→ vlastní třída / bezpečné prostředí
→ 2–3 učitelé
→ více tříd
→ evidence + bug/UX review
→ production rollout
```

Sbírat minimálně:

- time to start,
- completion/lesson survival,
- teacher interventions,
- misconception hotspots,
- hints/support usage,
- device/network failures,
- learning evidence quality,
- teacher willingness použít activity znovu.

Žádná vanity metrika nenahrazuje otázku:

> **Použil by to učitel příští týden znovu bez naší pomoci?**

---

# 16. Go-to-market thesis pro ČR

Primární claim nesmí být:

> „Máme hodně her.“

Cílový claim:

> **SkillStorm pomáhá škole převést její ŠVP do skutečné každodenní výuky — pomocí interaktivních laboratoří, map, simulací, jazykových aktivit, projektů a procvičování podle vybavení školy.**

Během přechodu RVP/ŠVP je silná capability:

- curriculum versioning,
- school-specific mapping,
- coverage transparency,
- lesson recommendations.

Marketingové tvrzení `RVP aligned/complete` se řídí Production Contractem, nikoli marketingovým rozhodnutím.

---

# 17. Co se nyní explicitně nezačíná

Dokud nejsou foundations a první vertical slices ověřené:

- marketplace jako hlavní priorita,
- masová tvorba stovek hardcoded miniher,
- full realtime 3D napříč předměty,
- vlastní školní chat/social network,
- AI auto-publishing curriculum content,
- real-product retail PC catalog,
- automatické high-stakes známkování hlasu,
- jedna velká „adaptive AI“ vrstva bez explainable evidence modelu.

---

# 18. Git / release pravidla

Každá velká fáze:

1. samostatná branch,
2. explicitní scope,
3. STOP checkpointy,
4. unit/integration/e2e podle risku,
5. real-browser verification pro UI/runtime,
6. documentation update ve stejném PR,
7. required CI green,
8. review před merge do `main`.

Schema/API/security změna bez dokumentačního diffu je nekompletní změna.

---

# 19. Exit criteria pro „ZŠ production-ready platform“

SkillStorm může interně označit Interactive Curriculum pro ZŠ za platformně production-ready až pokud:

```text
[ ] curriculum versioning funguje pro legacy/new transition
[ ] school ŠVP import/review/mapping je bezpečný a auditovatelný
[ ] coverage metriky jsou poctivě oddělené
[ ] Activity/Orchestration kernel je reuseovaný více subject engines
[ ] BOARD_ONLY funguje produkčně
[ ] SHARED_DEVICES funguje produkčně
[ ] DEVICES funguje produkčně
[ ] HYBRID funguje produkčně
[ ] reconnect/offline degradation je otestovaná
[ ] WCAG 2.2 AA scope je ověřený
[ ] privacy/security gates jsou uzavřené
[ ] asset/data provenance je vynucovaná
[ ] learning evidence semantics jsou versioned/explainable
[ ] více subject vertical slices prošlo reálným pilotem
[ ] teacher time-to-start je přijatelný v praxi
[ ] žádný release claim nepřekračuje skutečný coverage stav
```

To **není totéž** jako „máme obsah pro každý OVU“. Exhaustive content coverage je následná kontinuální disciplína.

---

# 20. Aktuální další krok

K datu 2026-08-07:

> **Dokončit a mergnout D0 — Documentation Hardening & Architecture Freeze.**

Poté:

> **D1 — Curriculum Foundation.**

Žádná nová subject-specific feature nemá přeskočit curriculum/data foundation jen proto, že je vizuálně atraktivní.

---

## Revizní log

| Datum | Změna |
| --- | --- |
| 2026-08-07 | Master Roadmap přestavěn kolem curriculum-aware classroom experience strategie. Přidány D0–D9, production/documentation gates, curriculum foundation, orchestration kernel a pořadí subject vertical slices. Původní Eduto doctrine označen jako superseded v documentation registry. |
| 2026-07-20 | Předchozí roadmap snapshot: board/live/guardian/pilot priority model. Zachován v git historii. |

---

## Související normativní dokumenty

- [`../README.md`](../README.md)
- [`../interactive-curriculum/PRODUCTION-CONTRACT.md`](../interactive-curriculum/PRODUCTION-CONTRACT.md)
- [`../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)
- [`../interactive-curriculum/README.md`](../interactive-curriculum/README.md)
- [`../interactive-curriculum/USE-CASES.md`](../interactive-curriculum/USE-CASES.md)
