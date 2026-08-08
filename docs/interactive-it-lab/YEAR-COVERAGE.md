# SkillStorm Interactive IT Lab — Celoroční kurikulum a production requirements

> **Status:** `VISION / APPROVED`  
> **Owner:** Product + Pedagogy + Informatics Review + Engineering  
> **Last review:** 2026-08-08  
> **Scope:** úplný recommended programme informatiky pro 4.–9. ročník ZŠ, použitelný jako výchozí celoroční obsahový plán SkillStormu a jako mapovací vrstva na konkrétní ŠVP školy.  
> **Purpose:** uzamknout před vývojem obsah, pedagogiku, coverage, classroom UX, learning evidence, safety, accessibility, assety, testování a budoucí implementační pořadí IT vertikály.  
> **Implementation state:** `NO RUNTIME IMPLEMENTATION IN THIS DOCUMENTATION PHASE`.

---

## 0. Normativní hranice

Tento dokument je **SkillStorm recommended progression**, nikoli státní ročníková osnova.

Revidovaný RVP ZV vymezuje informatiku ve čtyřech tematických okruzích:

1. Data, informace a modelování
2. Algoritmizace a programování
3. Informační systémy
4. Digitální technologie

Závazné očekávané výsledky učení jsou pro běžnou ZŠ formulované v uzlových bodech 5. a 9. ročníku. Konkrétní rozložení do jednotlivých ročníků určuje škola ve svém ŠVP.

SkillStorm proto musí oddělovat:

```text
RVP / OVU
   ↓
school ŠVP + school outcomes
   ↓
SkillStorm recommended year plan
   ↓
Lesson Experience
   ↓
Learning Evidence
```

Žádný ročníkový plán níže nesmí být prezentován jako „takto to stát nařizuje“.

### 0.1 Plánovací časová dotace

Pro výchozí content pack používáme model:

```text
1 vyučovací hodina týdně
32 core lessons
+ 3 FLEX / recovery / school-specific lessons
= 35 plánovacích slotů
```

Důvod:

- předmětový modelový ŠVP NPI používá 1 hodinu týdně ve 4. a 5. ročníku;
- modelový plán pro 2. stupeň používá 1 hodinu týdně v 6.–9. ročníku;
- skutečná škola může mít jinou organizaci, blokovou výuku nebo integrovaný předmět;
- SkillStorm musí podporovat kompresi i rozšíření.

Každý ročník proto musí existovat minimálně ve třech pacing profilech:

| Profil | Cíl |
| --- | --- |
| `CORE_28` | škola s menší skutečnou disponibilní výukou / vysokou absencí hodin |
| `STANDARD_32` | canonical SkillStorm ročník |
| `EXTENDED_36_PLUS` | disponibilní hodiny, seminář, rozšířená informatika |

### 0.2 Stav modelových ŠVP

Modelové ŠVP NPI jsou v době této revize pracovní/pilotní materiál. SkillStorm je používá jako **inspirativní a validační zdroj**, ne jako neměnnou legislativní databázi. Produkční mapping se musí vázat na verzovaný RVP release a na konkrétní publikované ŠVP školy.

### 0.3 Source provenance

Aktuální oficiální referenční zdroje:

- RVP ZV — Informatika: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/inf/inf`
- Data, informace a modelování: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/inf/inf/data-informace-a-modelovani`
- Algoritmizace a programování: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/inf/inf/algoritmizace-a-programovani`
- Informační systémy: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/inf/inf/informacni-systemy`
- Digitální technologie: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/inf/inf/digitalni-technologie`
- Modelové ŠVP: `https://revize.rvp.cz/zv/jak-na-svp/modelove-svp-pro-zs`

Při změně zdroje se nesmí starý mapping tiše přepsat. Musí vzniknout nový curriculum release / stale review.

---

# 1. RVP/OVU coverage contract

## 1.1 Uzlový bod 5. ročník

Níže je **krátká SkillStorm parafráze**, nikoli náhrada oficiálního znění.

- `INF-INF-001-ZV5-001` — Data → rozhodnutí.
- `INF-INF-001-ZV5-002` — Model situace a významné vztahy.
- `INF-INF-001-ZV5-003` — Odvození informací z modelu.
- `INF-INF-002-ZV5-004` — Posloupnost kroků řešení.
- `INF-INF-002-ZV5-005` — Blokový program s opakováním/podprogramy a debuggingem.
- `INF-INF-003-ZV5-006` — Účel informačního systému a jeho data.
- `INF-INF-003-ZV5-007` — Záznam číselných i nečíselných dat do evidence.
- `INF-INF-004-ZV5-008` — Volba aplikace/dat podle problému.
- `INF-INF-004-ZV5-009` — Propojená zařízení a přenos/získávání dat.
- `INF-INF-004-ZV5-010` — Rizika ztráty, poškození či zneužití dat.

## 1.2 Uzlový bod 9. ročník

- `INF-INF-001-ZV9-001` — Interpretace dat pro konkrétní problém.
- `INF-INF-001-ZV9-002` — Porovnání způsobů kódování dat.
- `INF-INF-001-ZV9-003` — Modelování situací včetně grafů/schémat.
- `INF-INF-001-ZV9-004` — Trénink a vyhodnocení jednoduchého ML modelu.
- `INF-INF-002-ZV9-005` — Porozumění cizímu algoritmu a jeho účelu.
- `INF-INF-002-ZV9-006` — Dekompozice problému a návrh algoritmů.
- `INF-INF-002-ZV9-007` — Blokový program: opakování, větvení, proměnné.
- `INF-INF-002-ZV9-008` — Testování, debugging a posouzení efektivity.
- `INF-INF-003-ZV9-009` — Účel, užitečnost a fungování informačního systému.
- `INF-INF-003-ZV9-010` — Návrh tabulkové evidence a pravidel záznamů.
- `INF-INF-003-ZV9-011` — Automatické zpracování a zobrazení dat pro potřeby uživatele.
- `INF-INF-004-ZV9-012` — Volba HW/SW/sítě podle vlastností a potřeb.
- `INF-INF-004-ZV9-013` — Zabezpečení zařízení/systémů podle rizik.
- `INF-INF-004-ZV9-014` — Fungování a dopady současných digitálních trendů.

## 1.3 Coverage state

Každý OVU/aspect musí mít samostatný stav:

```text
MISSING
PARTIAL
COVERED
VALIDATED
```

Význam:

- `MISSING` — nemáme dostatečnou experience/evidence.
- `PARTIAL` — aktivita se OVU dotýká, ale nepokrývá všechny významné aspekty.
- `COVERED` — máme obsah a evidence design.
- `VALIDATED` — coverage prošla pedagogickým review a reálným pilotem.

**Blueprint existence není coverage. Lesson existence není mastery. Completion není learning evidence.**

---

# 2. Produktový model celoroční informatiky

Ročník nemá být playlist náhodných miniher.

Každý ročník je sled:

```text
DIAGNOSTIC
  ↓
FOUNDATION
  ↓
GUIDED PRACTICE
  ↓
TRANSFER
  ↓
SYSTEM / PROJECT WORK
  ↓
MASTERY CHECK
  ↓
PORTFOLIO / REFLECTION
```

Každý modul musí obsahovat:

1. `HOOK / PROBLEM`
2. `PREDICT / PLAN`
3. `BUILD / MODEL / PROGRAM / ANALYZE`
4. `RUN / TEST`
5. `DEBUG / DIAGNOSE`
6. `EXPLAIN`
7. `TRANSFER`
8. `EVIDENCE`

---

# 3. Povinné lesson families

Celoroční IT pack musí používat opakovaně tyto reusable families:

| Family | Účel |
| --- | --- |
| `DATA_DETECTIVE` | získání, čištění a interpretace dat |
| `MODEL_LAB` | modely, grafy, systémové reprezentace |
| `ALGORITHM_FACTORY` | sekvence, dekompozice, automatizovatelnost |
| `BLOCK_PROGRAMMING` | tvorba a testování programu |
| `DEBUG_LAB` | chyba → hypotéza → test → oprava |
| `INFORMATION_SYSTEMS` | účel, role, procesy, evidence |
| `TABLE_DATA_LAB` | tabulky, pravidla, funkce, zobrazení |
| `INSIDE_COMPUTER` | hardware/software jako systém |
| `BUILD_A_PC` | assembly + compatibility + diagnosis |
| `NETWORK_BUILDER` | topologie a komunikace zařízení |
| `CYBER_DECISION` | bezpečnostní rozhodování bez offensive labu |
| `ML_LAB` | trénink a hodnocení jednoduchého modelu |
| `TREND_EXPLAINER` | principy a dopady současných technologií |
| `PROJECT_SPRINT` | integrovaný problém a digitální artefakt |
| `PORTFOLIO_REVIEW` | sebehodnocení a evidence pokroku |

Nová lesson family smí vzniknout pouze pokud stávající reusable capability pedagogický cíl neumí pokrýt.

---

# 4. 4. ročník — objevování dat, modelů, postupů a bezpečné práce

## 4.1 Ročníkový promise

Žák přestává vnímat počítač jako „krabičku s aplikacemi“. Začíná rozlišovat data, model, postup, systém a propojené zařízení.

Primární režimy:

- `DEVICES`
- `SHARED_DEVICES`
- `BOARD_ONLY` pro Human Robot / společné modelování
- `HYBRID` pro projektové hodiny

## 4.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Start: co je informatika | `Class system map + discussion` | Žák rozliší data, informace, postup a zařízení | `ZV5-001/002` |
| 2 | Data kolem nás | `Data Detective` | Seznam relevantních dat pro jednoduché rozhodnutí | `ZV5-001` |
| 3 | Rozhodnutí z dat | `Choose with Evidence` | Rozhodnutí + 2 datové důvody | `ZV5-001` |
| 4 | Data nejsou vždy čísla | `Card Sort` | Třídění text/číslo/obrázek/zvuk | `ZV5-001` |
| 5 | Model školní cesty | `Model the Situation` | Prvky + vztahy modelu | `ZV5-002` |
| 6 | Čtení z modelu | `Model Detective` | 3 informace odvozené z modelu | `ZV5-003` |
| 7 | Model může něco vynechat | `Compare Models` | Popis limitu modelu | `ZV5-002/003` |
| 8 | Přesný postup | `Human Robot` | Jednoznačná sekvence kroků | `ZV5-004` |
| 9 | Chyba v návodu | `Debug Instructions` | Nalezená nejednoznačnost + oprava | `ZV5-004` |
| 10 | Algoritmus s opakováním | `Pattern Robot` | Postup s opakující se částí | `ZV5-004/005` |
| 11 | První blokový program | `Block Mission` | Spustitelný krátký program | `ZV5-005` |
| 12 | Opakování v programu | `Loop Challenge` | Program používající smyčku | `ZV5-005` |
| 13 | Podprogram jako stavebnice | `Reusable Block` | Program s vlastním podprogramem | `ZV5-005` |
| 14 | Debugging I | `Broken Program` | Identifikace chyby + opravená verze | `ZV5-005` |
| 15 | Co je informační systém | `System Explorer` | Účel + vstupy/data systému | `ZV5-006` |
| 16 | Školní knihovna jako systém | `System Map` | Role, data a výstupy | `ZV5-006` |
| 17 | Seznam jako evidence | `List Builder` | Správně zadané číselné/nečíselné záznamy | `ZV5-007` |
| 18 | Tabulka jako evidence | `Table Builder` | Vyplněná tabulka podle pravidel | `ZV5-007` |
| 19 | Kontrola kvality dat | `Dirty Data Junior` | Nalezené chyby/duplicity | `ZV5-001/007` |
| 20 | Aplikace podle úkolu | `Tool Choice` | Volba nástroje + zdůvodnění | `ZV5-008` |
| 21 | Soubor, aplikace, data | `Digital Workspace` | Správné přiřazení objektů a rolí | `ZV5-008` |
| 22 | Zařízení spolu komunikují | `Connect Devices` | Jednoduchý model přenosu dat | `ZV5-009` |
| 23 | Posíláme data po síti | `Packet Story Junior` | Vysvětlení odkud-kam-proč | `ZV5-009` |
| 24 | Když nejde připojení | `Network Troubleshoot Junior` | Systematický první diagnostický postup | `ZV5-009` |
| 25 | Co se může stát s daty | `Risk Cards` | Riziko → dopad → prevence | `ZV5-010` |
| 26 | Záloha | `Backup Mission` | Rozhodnutí, co a proč zálohovat | `ZV5-010` |
| 27 | Hesla a přístupy | `Account Safety` | Bezpečnější volba + důvod | `ZV5-010` |
| 28 | Phishing junior | `Message Detective` | Rozpoznání varovných znaků | `ZV5-010` |
| 29 | Mini projekt: třídní evidence | `Project Build` | Model + tabulka + pravidla | `ZV5-002/006/007` |
| 30 | Mini projekt: naprogramuj misi | `Project Code` | Program + test | `ZV5-004/005` |
| 31 | Transfer challenge | `Mixed Mission` | Samostatná aplikace více konceptů | `ALL ZV5` |
| 32 | Portfolio + reflexe | `Evidence Review` | Výběr důkazu + sebehodnocení | `ALL ZV5` |

### 4.3 FLEX sloty

- FLEX-A — opakování podle diagnostiky třídy
- FLEX-B — school-specific digitální systém
- FLEX-C — projekt / absence / školní akce

### 4.4 Exit 4. ročníku

Žák má umět:

- použít jednoduchá data k rozhodnutí;
- vytvořit a číst jednoduchý model;
- navrhnout přesný postup;
- sestavit a opravit jednoduchý blokový program;
- vysvětlit účel jednoduchého informačního systému;
- zapsat data do evidence;
- bezpečně použít propojená zařízení;
- pojmenovat základní riziko dat a přiměřenou prevenci.

Nejde ještě o formální dosažení všech ZV5 outcomes; jde o přípravu na 5. ročník.

---

# 5. 5. ročník — uzavření prvostupňového outcome packu

## 5.1 Ročníkový promise

Na konci 5. ročníku musí SkillStorm umět dodat evidence ke všem deseti ZV5 OVU, pokud je konkrétní ŠVP školy skutečně zařazuje do tohoto course path.

## 5.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Diagnostický start 5. ročníku | `Adaptive Diagnostic` | Výchozí evidence bez známky | `ALL ZV5` |
| 2 | Data pro skutečné rozhodnutí | `Data Decision` | Otázka → data → závěr | `ZV5-001` |
| 3 | Více zdrojů dat | `Evidence Compare` | Porovnání 2–3 zdrojů | `ZV5-001` |
| 4 | Graf jako informace | `Graph Reader` | Odpovědi založené na grafu | `ZV5-001/003` |
| 5 | Model města | `System Model` | Prvky, vztahy, účel modelu | `ZV5-002` |
| 6 | Dva modely stejné situace | `Compare Models` | Volba vhodnější reprezentace | `ZV5-002/003` |
| 7 | Co z modelu neplyne | `Evidence Boundary` | Rozlišení závěru a domněnky | `ZV5-003` |
| 8 | Algoritmus od problému | `Algorithm Factory` | Sekvence řešící zadaný problém | `ZV5-004` |
| 9 | Algoritmus testujeme | `Trace & Test` | Test cases + oprava | `ZV5-004/005` |
| 10 | Smyčky | `Loop Lab` | Program se smyčkou | `ZV5-005` |
| 11 | Podprogramy | `Procedure Lab` | Rozdělení programu na opakovatelnou část | `ZV5-005` |
| 12 | Debugging II | `Bug Hunt` | Chyba → hypotéza → oprava | `ZV5-005` |
| 13 | Programovací mise | `Robot Rescue` | Funkční program s více strukturami | `ZV5-004/005` |
| 14 | Systém pod lupou | `Information System Explorer` | Účel + data + uživatelé | `ZV5-006` |
| 15 | Co systém ví a neví | `System Limits` | Přesný popis datového rozsahu | `ZV5-006` |
| 16 | Evidence dat | `Table Mission` | Záznamy dle pravidel | `ZV5-007` |
| 17 | Čištění evidence | `Dirty Data` | Opravy chyb bez změny významu | `ZV5-001/007` |
| 18 | Filtrování a hledání | `Find the Record` | Dohledání dat v evidenci | `ZV5-007` |
| 19 | Volba aplikace | `Tool Bench` | Nástroj podle problému | `ZV5-008` |
| 20 | Formát a kompatibilita | `Open It` | Volba formátu/aplikace | `ZV5-008` |
| 21 | Síť mezi zařízeními | `Network Builder Junior` | Správné propojení jednoduché sítě | `ZV5-009` |
| 22 | Cesta dat | `Packet Journey Junior` | Popis toku dat | `ZV5-009` |
| 23 | Sdílení souboru | `Share Safely` | Volba bezpečného způsobu sdílení | `ZV5-009/010` |
| 24 | Riziko ztráty dat | `Failure Scenario` | Prevence + recovery krok | `ZV5-010` |
| 25 | Riziko zneužití účtu | `Account Incident` | Rozpoznání incidentu + reakce | `ZV5-010` |
| 26 | Oprávnění | `Permission Cards` | Komu dát jaký přístup a proč | `ZV5-010` |
| 27 | Bezpečnostní scénář | `Cyber Decision Junior` | Riziko → rozhodnutí → důvod | `ZV5-010` |
| 28 | Capstone I: školní výlet | `Data + System Project` | Data/evidence/model pro reálný problém | `ZV5-001/002/006/007` |
| 29 | Capstone II: automatizuj postup | `Code Project` | Algoritmus + program + test | `ZV5-004/005` |
| 30 | Capstone III: bezpečně sdílej | `Network Project` | Přenos + rizika + prevence | `ZV5-008/009/010` |
| 31 | ZV5 mastery mission | `Outcome Challenge` | Integrovaný transfer bez nápovědy | `ALL ZV5` |
| 32 | Portfolio + přechod na 2. stupeň | `Evidence Review` | Portfolio + gap report | `ALL ZV5` |

### 5.3 FLEX sloty

- FLEX-A — remediace nejslabšího ZV5 clusteru
- FLEX-B — school-specific ŠVP activity
- FLEX-C — showcase / portfolio conference

### 5.4 ZV5 mastery gate

`ZV5 COMPLETE` se nesmí odvodit z procenta dokončených lekcí.

Potřebujeme minimálně:

```text
data evidence
model evidence
algorithm evidence
program/debug evidence
information-system evidence
table/evidence evidence
tool-choice evidence
networked-device evidence
security/risk evidence
transfer challenge
```

Teprve pedagogicky reviewovaný soubor těchto důkazů může označit SkillStorm content pack jako `COVERED`; mastery konkrétního žáka je samostatná inference a nesmí být automatická jen z completion.

---

# 6. 6. ročník — přechod k formálnějším modelům, programům a systémům

## 6.1 Ročníkový promise

Žák navazuje na ZV5 a přechází od konkrétních úloh k vědomé práci s reprezentací, dekompozicí, test cases, systémovými rolemi a bezpečnostními opatřeními.

## 6.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Baseline: co už umím | `Diagnostic Mission` | Mapa ZV5 prerequisite | `bridge` |
| 2 | Data vs informace | `Data Detective` | Otázka → relevantní data → informace | `ZV9-001` |
| 3 | Interpretace dat | `Data Story` | Závěr podložený daty | `ZV9-001` |
| 4 | Kódování textu/obrazu | `Encoding Lab` | Porovnání reprezentací | `ZV9-002` |
| 5 | Přenos a komprese | `Encoding Trade-off` | Volba kódování podle účelu | `ZV9-002` |
| 6 | Model jako zjednodušení | `Model Lab` | Model + jeho omezení | `ZV9-003` |
| 7 | Graf jako síť vztahů | `Graph Builder` | Uzly/hrany + interpretace | `ZV9-003` |
| 8 | Čtení algoritmu | `Trace the Algorithm` | Vysvětlení cíle algoritmu | `ZV9-005` |
| 9 | Rozklad problému | `Decompose It` | Podproblémy + pořadí | `ZV9-006` |
| 10 | Program: proměnná | `Variable Lab` | Program se stavem | `ZV9-007` |
| 11 | Program: větvení | `Branch Lab` | Podmíněné chování | `ZV9-007` |
| 12 | Program: opakování | `Loop Lab II` | Efektivní smyčka | `ZV9-007` |
| 13 | Testování programu | `Test Case Lab` | Sada testů + evidence | `ZV9-008` |
| 14 | Debugging podle symptomu | `Bug Diagnosis` | Hypotéza + ověření | `ZV9-008` |
| 15 | Co je informační systém | `System Explorer II` | Účel + proces + data | `ZV9-009` |
| 16 | Uživatelé a role | `Role Model` | Role → akce → data | `ZV9-009` |
| 17 | Evidence pro problém | `Table Design` | Sloupce, typy, pravidla | `ZV9-010` |
| 18 | Validace záznamů | `Data Rules` | Pravidla kvality evidence | `ZV9-010` |
| 19 | Automatické zpracování | `Table Functions Intro` | Výpočet/filtr řešící potřebu | `ZV9-011` |
| 20 | Hardware jako systém | `Inside the Computer` | Komponenta → funkce → vazba | `ZV9-012` |
| 21 | Software a OS | `Software Stack` | Vrstva → role → závislost | `ZV9-012` |
| 22 | Síťové prvky | `Network Builder I` | PC/AP/switch/router model | `ZV9-012` |
| 23 | Diagnostika připojení | `Network Fault I` | Systematický troubleshooting | `ZV9-012` |
| 24 | Riziko a ochrana | `Security Triangle` | Riziko → opatření | `ZV9-013` |
| 25 | Zálohy a aktualizace | `Resilience Mission` | Plán prevence/recovery | `ZV9-013` |
| 26 | Phishing a sociální inženýrství | `Cyber Decision` | Rozpoznání + bezpečná reakce | `ZV9-013` |
| 27 | Digitální trend: AI jako systém | `Trend Explainer` | Vysvětlení principu bez magie | `ZV9-014` |
| 28 | Projekt: navrhni systém | `System Project` | Model + evidence + role | `ZV9-003/009/010` |
| 29 | Projekt: naprogramuj řešení | `Program Project` | Program + testy + debugging | `ZV9-006/007/008` |
| 30 | Projekt: bezpečný provoz | `Security Project` | Threat model junior | `ZV9-013` |
| 31 | Transfer challenge | `Mixed Mission` | Samostatný přenos konceptů | `multi` |
| 32 | Portfolio/reflexe | `Evidence Review` | Silné stránky + další cíl | `multi` |

### 6.3 FLEX sloty

- FLEX-A — prerequisite recovery
- FLEX-B — delší programming challenge
- FLEX-C — cross-curricular data project

---

# 7. 7. ročník — data, informační systémy, síť a první ML

## 7.1 Ročníkový promise

Žák má přestat řešit úlohy metodou náhodného zkoušení. Systematicky pracuje s daty, testy, modely, topologií a diagnostikou.

## 7.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Start: problém, data, systém | `Diagnostic` | Výchozí mapa | `multi` |
| 2 | Sběr dat | `Data Collection` | Datový plán pro otázku | `ZV9-001` |
| 3 | Čištění dat | `Dirty Data Lab` | Opravená sada + log změn | `ZV9-001` |
| 4 | Graf a interpretace | `Visualization Lab` | Graf + závěr + limit | `ZV9-001` |
| 5 | Kódování a přenos | `Encoding Challenge` | Porovnání dvou kódování | `ZV9-002` |
| 6 | Modelování sítí vztahů | `Graph Model` | Graf + odvozené informace | `ZV9-003` |
| 7 | Algoritmus pozpátku | `What Problem?` | Určení problému z algoritmu | `ZV9-005` |
| 8 | Dekompozice větší úlohy | `Problem Breakdown` | Moduly řešení | `ZV9-006` |
| 9 | Program: kombinace struktur | `Control Flow` | Smyčka + podmínka + proměnná | `ZV9-007` |
| 10 | Program: stav a událost | `Interactive Program` | Program reagující na událost | `ZV9-007` |
| 11 | Testy hranic | `Edge Case Lab` | Hraniční testy | `ZV9-008` |
| 12 | Efektivita postupu | `Algorithm Compare` | Porovnání dvou řešení | `ZV9-008` |
| 13 | Debug sprint | `Bug Hunt II` | Diagnostický záznam | `ZV9-008` |
| 14 | IS: proces a uživatel | `System Journey` | Procesní mapa | `ZV9-009` |
| 15 | IS: návrh evidence | `Record Schema` | Návrh tabulky + pravidla | `ZV9-010` |
| 16 | Funkce a filtry | `Data Automation` | Automatizované zpracování | `ZV9-011` |
| 17 | Dashboard pro uživatele | `View for Need` | Zobrazení dat pro konkrétní potřebu | `ZV9-011` |
| 18 | Síť: topologie | `Network Builder II` | Funkční topologie | `ZV9-012` |
| 19 | Síť: cesta paketu jako model | `Packet Journey` | Popis toku + limit modelu | `ZV9-012` |
| 20 | Wi-Fi vs kabel | `Connection Trade-off` | Volba s argumenty | `ZV9-012` |
| 21 | Síťová závada | `Network Fault II` | Diagnóza bez random trial | `ZV9-012` |
| 22 | Účty a oprávnění | `Permission Model` | Least-privilege návrh | `ZV9-013` |
| 23 | Threat modeling | `Threat Cards` | Aktivum → hrozba → opatření | `ZV9-013` |
| 24 | Incident response | `Cyber Incident I` | Prioritizovaná reakce | `ZV9-013` |
| 25 | Digitální stopa a data | `Data Risk Scenario` | Riziko + prevence | `ZV9-013` |
| 26 | Trend: cloud | `Trend Systems` | Princip + výhoda + riziko | `ZV9-014` |
| 27 | Trend: AI/ML vstup | `ML Concept` | Data → trénink → výstup | `ZV9-004/014` |
| 28 | Mini ML experiment | `Train a Tiny Model` | Model + jednoduché hodnocení | `ZV9-004` |
| 29 | Projekt: data pro školu | `Data Project` | Sběr → čištění → vizualizace | `ZV9-001/011` |
| 30 | Projekt: síť pro učebnu | `Network Project` | Topologie + bezpečnost | `ZV9-012/013` |
| 31 | Transfer challenge | `System Mission` | Integrovaný problém | `multi` |
| 32 | Portfolio/reflexe | `Evidence Review` | Výběr důkazů + cíle | `multi` |

### 7.3 FLEX sloty

- FLEX-A — programming remediation
- FLEX-B — network lab extension
- FLEX-C — data/ML extension

---

# 8. 8. ročník — Interactive IT Lab / Build-a-PC / sítě / bezpečnost / ML

## 8.1 Ročníkový promise

8. ročník je hlavní **technický systems year**. Tady vzniká plný device-first Interactive IT Lab.

Build-a-PC není samostatná atrakce. Je jednou částí širšího cíle:

> umět z požadavku odvodit architekturu, sestavit systém, otestovat jej, diagnostikovat a vysvětlit trade-off.

## 8.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Start: digitální systém jako celek | `Diagnostic` | Výchozí mapa | `multi` |
| 2 | Komponenty PC a jejich role | `Inside the Computer II` | Komponenta → role → závislost | `ZV9-012` |
| 3 | Motherboard a sběrnice | `System Map` | Vazby komponent | `ZV9-012` |
| 4 | CPU + chlazení | `Build a PC` | Správná instalace + vysvětlení | `ZV9-012` |
| 5 | RAM + kompatibilita | `Build a PC` | Volba/placement + diagnóza | `ZV9-012` |
| 6 | Úložiště | `Storage Trade-off` | Volba podle potřeby | `ZV9-012` |
| 7 | GPU + napájení | `Build a PC` | Kompatibilita + výkonový požadavek | `ZV9-012` |
| 8 | PSU + kabeláž | `Build a PC` | Bezpečné zapojení modelu | `ZV9-012` |
| 9 | POST a první diagnostika | `Boot Failure` | Symptom → hypotéza → test | `ZV9-012` |
| 10 | Build-a-PC transfer | `Build Challenge` | Funkční sestava pod constraints | `ZV9-012` |
| 11 | Hardware vs software | `Stack Diagnosis` | Určení vrstvy problému | `ZV9-012` |
| 12 | Výběr zařízení pro uživatele | `Procurement Simulation` | Požadavky → volba → trade-off | `ZV9-012` |
| 13 | Síť pro domácnost/školu | `Network Builder III` | Topologie a role prvků | `ZV9-012` |
| 14 | Adresování jako model | `Network Identity` | Jednoduché vysvětlení identifikace | `ZV9-012` |
| 15 | DNS/web cesta jako model | `Request Journey` | Vrstevnaté vysvětlení | `ZV9-012/014` |
| 16 | Síťová diagnostika | `Fault Lab` | Testovací plán | `ZV9-012` |
| 17 | Bezpečnost zařízení | `Hardening Lab` | Opatření podle rizika | `ZV9-013` |
| 18 | Zálohovací strategie | `Backup Design` | 3-2-1 koncept přiměřeně | `ZV9-013` |
| 19 | Oprávnění a role | `Access Control Lab` | Role model + důvod | `ZV9-013` |
| 20 | Phishing incident | `Cyber Incident II` | Detekce + eskalace | `ZV9-013` |
| 21 | Ransomware scénář bez malware | `Recovery Decision` | Izolace + obnova konceptuálně | `ZV9-013` |
| 22 | Data pipeline | `Data Pipeline` | Transformace dat | `ZV9-001/011` |
| 23 | Datová evidence | `Database Builder` | Schéma/tabulka/pravidla | `ZV9-010` |
| 24 | Automatizace evidence | `Functions Lab` | Funkce/filtry/view | `ZV9-011` |
| 25 | Model ML: dataset | `ML Dataset` | Features/labels koncept | `ZV9-004` |
| 26 | Trénink modelu | `Train a Model` | Natrénovaný model | `ZV9-004` |
| 27 | Vyhodnocení modelu | `Model Evaluation` | Výkon + chyba + limit | `ZV9-004` |
| 28 | Bias/nekvalitní data | `ML Failure` | Vysvětlení vlivu dat | `ZV9-004` |
| 29 | Trend: generativní AI | `Trend Debate` | Princip + limity + rizika | `ZV9-014` |
| 30 | Projekt: servisní případ | `Technician Mission` | Diagnóza PC/sítě | `ZV9-012/013` |
| 31 | Transfer challenge | `Engineer Mission` | Constraints + diagnosis + explanation | `multi` |
| 32 | Portfolio/reflexe | `Evidence Review` | Portfolio + gap | `multi` |

### 8.3 FLEX sloty

- FLEX-A — Build-a-PC extended technician challenge
- FLEX-B — school network scenario
- FLEX-C — ML/data remediation

### 8.4 Build-a-PC minimum asset set

Před produkční implementací musí existovat licenčně čistý a pedagogicky reviewovaný set:

- case;
- motherboard;
- CPU;
- cooler;
- RAM;
- SSD;
- GPU;
- PSU;
- power connectors;
- basic motherboard ports;
- monitor/output;
- diagnostic states.

MVP nepoužívá reálné komerční značky, pokud není vyřešené právo/brand usage.

---

# 9. 9. ročník — mastery, architektura, bezpečnost a capstone

## 9.1 Ročníkový promise

9. ročník spojuje všech 14 ZV9 outcomes do samostatného řešení problémů. Žák má být schopný říct nejen **co udělal**, ale **proč**, jak to testoval, co by selhalo a jaké jsou limity jeho řešení.

## 9.2 STANDARD_32

| # | Lekce | Experience | Povinná evidence | Primární OVU |
| ---: | --- | --- | --- | --- |
| 1 | Start: mastery diagnostic | `Outcome Diagnostic` | Mapa 14 ZV9 OVU | `ALL ZV9` |
| 2 | Data pro rozhodnutí | `Evidence Room` | Interpretace + nejistota | `ZV9-001` |
| 3 | Kódování dat | `Representation Trade-off` | Volba kódování | `ZV9-002` |
| 4 | Model komplexní situace | `Graph/System Model` | Více reprezentací | `ZV9-003` |
| 5 | ML experiment | `Train & Evaluate` | Model + hodnocení | `ZV9-004` |
| 6 | ML limit a generalizace | `Model Failure` | Vysvětlení selhání | `ZV9-004` |
| 7 | Čtení cizího algoritmu | `Algorithm Reverse` | Cíl + postup | `ZV9-005` |
| 8 | Dekompozice projektu | `Project Breakdown` | Moduly + závislosti | `ZV9-006` |
| 9 | Programovací challenge | `Build Program` | Větvení+smyčky+proměnné | `ZV9-007` |
| 10 | Test-driven debugging | `Test & Fix` | Testy + iterace | `ZV9-008` |
| 11 | Efektivita a trade-off | `Compare Solutions` | Argumentované porovnání | `ZV9-008` |
| 12 | IS audit | `System Audit` | Účel, proces, užitečnost | `ZV9-009` |
| 13 | Navrhni evidenci | `Schema Challenge` | Tabulka + pravidla | `ZV9-010` |
| 14 | Automatizuj evidenci | `Automation View` | Funkce + zobrazení | `ZV9-011` |
| 15 | Architektura digitálního řešení | `System Architect` | HW/SW/network volba | `ZV9-012` |
| 16 | Síť pod constraints | `Network Architect` | Topologie + trade-offs | `ZV9-012` |
| 17 | Security threat model | `Threat Model` | Aktiva/hrozby/opatření | `ZV9-013` |
| 18 | Incident tabletop | `Cyber Incident III` | Prioritní reakce + evidence | `ZV9-013` |
| 19 | Trend: cloud/edge/IoT | `Trend Systems` | Fungování + dopady | `ZV9-014` |
| 20 | Trend: AI/automatizace | `Trend Systems` | Fungování + dopady + limity | `ZV9-014` |
| 21 | Etika/dopady technologií | `Structured Debate` | Argumenty + evidence | `ZV9-014` |
| 22 | Capstone brief | `Project Sprint 1` | Problém + uživatel + criteria | `multi` |
| 23 | Capstone model | `Project Sprint 2` | Model + data | `001/003` |
| 24 | Capstone algorithm | `Project Sprint 3` | Postup + dekompozice | `005/006` |
| 25 | Capstone prototype | `Project Sprint 4` | Funkční digitální artefakt | `007/009/012` |
| 26 | Capstone data layer | `Project Sprint 5` | Evidence/automation | `010/011` |
| 27 | Capstone security | `Project Sprint 6` | Risk review | `013` |
| 28 | Capstone testing | `Project Sprint 7` | Test cases + fixes | `008` |
| 29 | Capstone presentation | `Project Sprint 8` | Vysvětlení rozhodnutí | `multi` |
| 30 | Mastery station A | `Outcome Stations` | Data/algorithm mastery | `001-008` |
| 31 | Mastery station B | `Outcome Stations` | Systems/tech mastery | `009-014` |
| 32 | Portfolio + transition | `Evidence Review` | 14-OVU coverage report | `ALL ZV9` |

### 9.3 FLEX sloty

- FLEX-A — missing outcome remediation
- FLEX-B — capstone extension
- FLEX-C — transition / showcase / school-specific outcome

### 9.4 ZV9 exit gate

Ročníkový content pack je možné označit jako `ZV9 COVERAGE READY` pouze pokud existuje reviewovaná evidence cesta pro všech 14 OVU.

Žákovské mastery se vyhodnocuje samostatně a explainably.

---

# 10. ŠVP adapter

Celoroční program musí jít přizpůsobit konkrétní škole bez forku kódu.

## 10.1 School mapping

Každá škola může mít:

- jiné názvy předmětu;
- jiný ročník, ve kterém outcome rozvíjí;
- integrovanou informatiku;
- blokovou výuku;
- rozdílnou hodinovou dotaci;
- vlastní školní výsledky učení;
- vlastní projekty a lokální obsah.

SkillStorm proto potřebuje budoucí mapování:

```text
SchoolSubject
SchoolOutcome
SchoolCurriculumVersion
CurriculumApplicability
        ↓
canonical RVP outcome/aspect
        ↓
recommended SkillStorm lessons
        ↓
teacher override
```

## 10.2 Recommendation, not lock

Učitel smí:

- přesunout modul;
- přeskočit již zvládnutý modul;
- přidat lokální aktivitu;
- zvolit jiný delivery mode;
- změnit scaffolding;
- použít vlastní asset/data set;
- vypnout adaptivní doporučení.

Systém ale musí upozornit, pokud tím vznikne `MISSING` coverage pro relevantní school outcome.

---

# 11. Lesson Experience contract pro IT

Každá produkční IT lesson musí mít minimálně:

```yaml
id:
version:
title:
subject: INFORMATICS
recommendedGrade:
durationMinutes:
deliveryModes:
prerequisites:
curriculumMappings:
learningObjectives:
successCriteria:
stages:
checkpoints:
evidenceSchema:
difficultyLevels:
scaffoldingModes:
accessibility:
assets:
assetProvenance:
teacherNotes:
fallbackPlan:
telemetryPolicy:
privacyClass:
reviewState:
```

## 11.1 Stage contract

Doporučené stage typy:

- `HOOK`
- `PREDICT`
- `MODEL`
- `BUILD`
- `PROGRAM`
- `RUN`
- `TEST`
- `DIAGNOSE`
- `TEACHER_INTERVENTION`
- `TRANSFER`
- `REFLECT`

Lekce nemusí použít všechny, ale nesmí redukovat informatiku na `READ → QUIZ`.

---

# 12. Learning evidence

## 12.1 Povolené evidence

- vytvořený model;
- datová transformace;
- interpretace;
- algoritmus;
- program version;
- test case;
- debug hypothesis;
- fault diagnosis;
- topology;
- component selection;
- permission/security decision + rationale;
- system design;
- project artifact;
- reflection.

## 12.2 Zakázané shortcuty

Nesmí platit:

```text
activity completed == outcome mastered
fastest student == best student
fewest clicks == best solution
no hint == mastery
high XP == curriculum mastery
```

## 12.3 Evidence provenance

Evidence musí nést minimálně:

- activity version;
- curriculum mapping version;
- student/class/org scope;
- timestamp;
- delivery mode;
- difficulty;
- scaffolding;
- assessment/review origin;
- optional teacher confirmation.

---

# 13. Teacher Mission Control

Teacher dashboard musí odpovídat na pedagogické otázky:

- kdo je na kterém checkpointu;
- jaký typ chyby se opakuje;
- kdo je idle/reconnecting;
- kdo žádá o pomoc;
- který misconception se šíří třídou;
- kdo je hotový a potřebuje transfer challenge.

## 13.1 Povinné commandy

- `PAUSE_ALL`
- `RESUME_ALL`
- `SHOW_DEMO`
- `SEND_HINT`
- `CHANGE_SCAFFOLDING`
- `OPEN_TRANSFER_CHALLENGE`
- `END_SESSION`

## 13.2 Co nesmí Mission Control dělat

- screen streaming;
- screenshot capture;
- raw keystroke logging;
- pointer telemetry;
- public weakest-student leaderboard;
- covert behavioral scoring.

---

# 14. Delivery modes

## `DEVICES`

Primární pro programování, data, Build-a-PC, sítě, ML a projekty.

## `SHARED_DEVICES`

Povinně podporovaný pro školy s omezeným hardwarem:

- dvojice/skupiny;
- role rotation;
- group evidence + optional individual reflection.

## `BOARD_ONLY`

Použitelné zejména pro:

- Human Robot;
- algorithm tracing;
- společný debugging;
- modelování systému;
- cyber scenario;
- teacher demo.

Nemá předstírat individual evidence tam, kde žádná individualizace neexistuje.

## `HYBRID`

Board = společný problém/demo, zařízení = student/group work.

---

# 15. Accessibility / SVP

Každá IT experience musí být navržená tak, aby learning objective nebyl svázaný s jedním motorickým inputem.

Povinně:

- keyboard path;
- tap-select/tap-place alternativa k drag-only;
- focus order;
- reduced motion;
- zoom/reflow;
- sufficient target size;
- text alternative ke grafickému komponentovému modelu tam, kde je smysluplná;
- barva není jediný nositel významu;
- časový tlak není default;
- TTS/read-aloud u instrukcí tam, kde to pomáhá;
- možnost `GUIDED / ASSISTED / INDEPENDENT`;
- difficulty a scaffolding zůstávají oddělené.

Pro žáka s motorickým omezením nesmí být horší hodnocení jen proto, že nepoužil drag & drop.

---

# 16. Security / privacy / sandbox

## 16.1 Student data

- tenant isolation vždy server-side;
- student activity state scope na organization/session/user;
- minimalizace osobních dat;
- semantic telemetry only;
- žádné raw screen/keyboard capture.

## 16.2 Programování

Pokud budoucí lekce spouští nedůvěryhodný kód:

- nikdy přímo na host serveru;
- použít izolovaný sandbox;
- resource/time limits;
- no arbitrary network access by default;
- no secrets/env exposure;
- deterministic cleanup.

## 16.3 Cyber lessons

Pouze defenzivní/věkově přiměřené scénáře:

- phishing recognition;
- account protection;
- permissions;
- backup;
- safe configuration;
- risk assessment;
- incident response.

Ne:

- credential theft;
- malware creation;
- offensive exploitation;
- real target scanning;
- bypass security controls.

---

# 17. Realtime event contract

Student zařízení neposílá pointer frames. Posílá významné události.

Příklady:

```text
ACTIVITY_STARTED
CHECKPOINT_STARTED
MODEL_NODE_ADDED
ALGORITHM_STEP_ADDED
PROGRAM_RUN
TEST_FAILED
DEBUG_HYPOTHESIS_SUBMITTED
COMPONENT_SELECTED
COMPONENT_PLACED
PLACEMENT_REJECTED
CONNECTION_CREATED
CONFIG_CHANGED
FAULT_DIAGNOSED
HINT_REQUESTED
CHECKPOINT_COMPLETED
TRANSFER_COMPLETED
ACTIVITY_COMPLETED
```

## 17.1 Event requirements

Každá persisted event musí řešit:

- `eventId`;
- idempotency;
- session/activity version;
- actor;
- semantic payload;
- server timestamp;
- optional client timestamp;
- schema version.

No high-frequency raw telemetry.

---

# 18. Reconnect / resilience

Reálná školní Wi-Fi je součást produktu.

Povinné stavy:

```text
ONLINE
DEGRADED
OFFLINE_LOCAL
RECONNECTING
RESYNCED
FAILED_SAFE
```

Po reconnectu:

- nesmí vzniknout duplicate evidence;
- student pokračuje co nejblíž poslednímu potvrzenému checkpointu;
- teacher vidí reconnect stav;
- lokální pending event queue má omezenou velikost;
- konflikt se řeší deterministicky;
- lesson musí mít fallback, pokud realtime vypadne úplně.

---

# 19. Performance targets

Pilotní minimum pro `DEVICES`:

```text
30 současných studentů
+ 1 teacher
+ 1 board
```

Požadavky:

- bez screen streaming;
- teacher semantic update typicky do 1–2 s;
- renderer zůstává interaktivní na běžném školním zařízení;
- asset preload je bounded;
- žádné obří 3D bundle jako povinný základ;
- Build-a-PC MVP preferuje 2.5D;
- network/graph UI nesmí padat s velikostí běžné školní úlohy.

---

# 20. Asset pipeline

Každý asset musí mít:

```text
assetId
source
author
license
licenseVersion
modifications
createdAt / importedAt
reviewedBy
allowedUses
```

Preferovat:

- vlastní SkillStorm assety;
- CC0;
- kompatibilně licencované zdroje.

Build-a-PC používá fiktivní/generické komponenty, dokud nejsou vyřešené reálné značky.

AI-generated asset musí být označen interní provenance metadatou a projít lidským vizuálním/pedagogickým review.

---

# 21. Content authoring

Učitel nemá authorovat fyzikální engine ani compatibility code.

Authoring musí oddělit:

```text
ENGINE CAPABILITY
        +
CONTENT DEFINITION
        +
CURRICULUM MAPPING
        +
ASSETS
        +
EVIDENCE RULES
```

Obsahový editor má v budoucnu umět:

- duplikovat lesson;
- měnit text/instrukce;
- měnit dataset;
- měnit komponentový katalog v povoleném schématu;
- přidat fault;
- měnit difficulty/scaffolding;
- přidat local ŠVP mapping;
- preview;
- validate;
- publish immutable version.

---

# 22. Hodnocení

SkillStorm doporučuje primárně formativní evidence.

Učitel může následně mapovat evidence na školní hodnocení, ale engine sám nesmí z komplexního procesu bez vysvětlení produkovat high-stakes známku.

Povinné výstupy:

- co žák dokázal;
- na čem se zasekl;
- jaký typ nápovědy potřeboval;
- zda zvládl transfer;
- které evidence supporting outcome existují.

---

# 23. Portfolio

Od 4. do 9. ročníku se žákovský IT profil může skládat z artefaktů:

- model;
- program;
- datový výstup;
- systémový návrh;
- síť;
- diagnostický protokol;
- security rationale;
- capstone.

Portfolio nesmí být veřejný leaderboard.

---

# 24. Cross-curricular reuse

IT engine má být reuseovaný:

- matematika — data, grafy, algoritmy;
- geografie — geodata;
- fyzika — systémy, měření, elektrické modely;
- polytechnika — build/diagnose;
- občanka/VZB — privacy/cyber/media;
- jazyky — digitální komunikace;
- přírodopis/chemie — data pipeline a modely.

Reuse nesmí deformovat subject pedagogy.

---

# 25. Lokalizace

Content model nesmí hardcodovat češtinu do engine.

Rozdělit:

- engine;
- locale strings;
- curriculum mapping;
- region-specific examples;
- legal/privacy copy;
- assets with embedded text.

To je nutné pro budoucí evropské nasazení.

---

# 26. Test strategy

## 26.1 Unit

- deterministic rules;
- compatibility;
- model transforms;
- evidence aggregation;
- event idempotency;
- mapping resolver.

## 26.2 Integration

- session state;
- reconnect;
- teacher commands;
- evidence persistence;
- tenant isolation;
- curriculum versioning.

## 26.3 Browser

- keyboard-only;
- touch;
- reduced motion;
- 360px responsive teacher/student critical flows where relevant;
- real Chromium;
- stale session recovery.

## 26.4 Classroom simulation

Minimálně:

```text
30 clients
→ start
→ progress
→ errors
→ pause
→ reconnect subset
→ resume
→ finish
→ evidence dedupe
```

---

# 27. Pilot contract

Každý nový lesson family:

```text
internal
→ 1 bezpečná reálná třída
→ 2–3 učitelé
→ více tříd
→ evidence review
→ production decision
```

Sbírat:

- time to first meaningful action;
- time to start lesson;
- completion/survival;
- bottleneck;
- hints;
- random trial vs diagnostic behavior;
- reconnect failures;
- teacher interventions;
- learning evidence quality;
- transfer performance;
- teacher willingness lesson znovu použít;
- accessibility issues.

---

# 28. Production acceptance criteria pro IT vertikálu

```text
[ ] relevantní RVP/OVU release je verzovaný
[ ] school ŠVP mapping funguje bez hardcoded ročníku
[ ] 4.–9. year plans existují jako versioned content pack
[ ] 5. ročník má evidence coverage pro všech 10 ZV5 outcomes
[ ] 9. ročník má evidence coverage pro všech 14 ZV9 outcomes
[ ] engine není hardcoded jen pro Build-a-PC
[ ] teacher může lesson spustit bez developerské pomoci
[ ] BOARD_ONLY / SHARED / DEVICES / HYBRID semantics jsou pravdivé
[ ] difficulty != scaffolding
[ ] keyboard/tap alternative existuje
[ ] no public student ranking
[ ] no screen/pointer/keystroke surveillance
[ ] security scenarios jsou defensive-only
[ ] untrusted code execution je sandboxed, pokud existuje
[ ] semantic events jsou idempotentní
[ ] reconnect neprodukuje duplicate evidence
[ ] asset provenance je kompletní
[ ] 30-client classroom test projde
[ ] pilot evidence potvrzuje pedagogickou hodnotu
[ ] release claim nepřekračuje skutečný coverage state
```

---

# 29. Budoucí implementační pořadí — po ukončení documentation freeze

**Tato sekce není povolení začít vývoj před splněním Master Roadmap gates.**

Po stabilizaci paralelních foundation PR a D0/D1/D2 doporučujeme IT jako první subject vertical:

```text
IT-0  curriculum mapping + year pack import
IT-1  Algorithm / Human Robot / tracing primitives
IT-2  Block programming + test/debug evidence
IT-3  Data/Table/Information System primitives
IT-4  SystemBuilder foundation
IT-5  Build-a-PC vertical slice
IT-6  Network Builder
IT-7  Security / Permission scenarios
IT-8  ML Lab
IT-9  Project/Capstone orchestration
IT-10 whole-year coverage validation
```

Každý krok = samostatný reviewovatelný PR nebo malá koherentní série, ne jeden mega-branch.

---

# 30. Explicitní non-goals

Nezačínáme:

- stovkami hardcoded miniher;
- generickým LMS kurzem s videem + kvízem;
- plným PC Building Simulatorem;
- fotorealistickým 3D jako architektonickou podmínkou;
- e-shopem hardwaru;
- reálným SKU katalogem bez licencí;
- offensive cyber range;
- vlastním obecným cloud IDE jako první feature;
- AI auto-publishingem curriculum content;
- automatickým high-stakes mastery score bez evidence;
- sledováním obrazovek žáků;
- gamifikací založenou na rychlosti;
- paralelním auth/RBAC modelem uvnitř IT Labu.

---

# 31. Documentation freeze / hand-off

Po merge tohoto dokumentačního balíku:

```text
IT CONTENT / PRODUCT REQUIREMENTS = FROZEN FOR IMPLEMENTATION BASELINE
RUNTIME DEVELOPMENT = NOT STARTED
```

Změna některého z těchto kontraktů během budoucí implementace vyžaduje:

1. explicitní důvod;
2. dokumentační diff;
3. dopad na RVP/ŠVP coverage;
4. dopad na security/privacy/accessibility;
5. test změny kontraktu;
6. review před merge.

---

# 32. Final invariant

> **SkillStorm informatika musí pokrýt celý rok tak, aby učitel nemusel skládat výuku z náhodných aktivit. Každá hodina má své místo v progresi, každé důležité OVU má dohledatelnou evidence cestu a žádný engine nesmí zaměnit dokončení hry za skutečné učení.**
