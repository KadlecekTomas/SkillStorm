# SkillStorm Interactive Curriculum — Production Contract

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Pedagogy + Engineering + Security  
> **Last verified:** 2026-08-07  
> **Scope:** všechny budoucí Lesson Experiences, Activity/Subject Engines, classroom delivery modes, learning evidence a curriculum-aware workflows pro ZŠ  
> **Precedence:** tento dokument má při konfliktu přednost před product/subject blueprints; curriculum data semantics dále zpřesňuje [`CURRICULUM-DATA-CONTRACT.md`](./CURRICULUM-DATA-CONTRACT.md).

---

## 0. Účel

Tento dokument převádí produktovou vizi SkillStorm Interactive Curriculum do **implementačně závazných invariantů**.

Product blueprints smějí být ambiciózní. Production contract musí být konzervativní, přesný a testovatelný.

Cíl není slíbit, že software nikdy nebude mít chybu. Cíl je odstranit nejasnosti, které by umožnily dvěma vývojářům implementovat stejnou věc dvěma neslučitelnými způsoby, a definovat release gates, které musí chyby zachytit před nasazením.

---

# 1. Produktový kontrakt

## 1.1 Primární jednotka není Question

Pro Interactive Curriculum je primární pedagogickou jednotkou:

```text
Curriculum Outcome / school goal
        ↓
Lesson Experience
        ↓
Activity Definition / stages
        ↓
Interaction / Subject Engine
        ↓
Learning Evidence
```

Existující `Test`, `Question`, `Assignment`, `Submission` a Bleskovky se **nesmějí automaticky rozšiřovat** tak, aby absorbovaly simulace, Map Lab, Chem Lab, Audio Lab, Build-a-PC nebo jiné komplexní aktivity.

Klasický test je jeden typ výukového artefaktu. Není univerzální runtime celé platformy.

## 1.2 Jeden obsahový cíl může mít více delivery modes

Normativní delivery modes:

- `BOARD_ONLY`
- `SHARED_DEVICES`
- `DEVICES`
- `HYBRID`

Každá Lesson Experience deklaruje:

- `supportedModes`,
- `recommendedMode`,
- minimální hardware,
- zda režim zachovává stejný learning objective,
- případné odlišné learning evidence podle režimu.

**SkillStorm doporučuje. Učitel rozhoduje.**

Systém nesmí bez explicitního důvodu blokovat učitele jen proto, že preferuje jiný podporovaný mode.

## 1.3 Hardware školy je constraint, ne předpoklad

Produkční Lesson Experience nesmí implicitně předpokládat 1:1 zařízení, pokud její metadata neříkají `DEVICES_ONLY` a pedagogický review tento limit výslovně schválil.

Při návrhu musí být vždy vyhodnoceno, zda lze zachovat pedagogickou hodnotu také v `BOARD_ONLY`, `SHARED_DEVICES` nebo `HYBRID` variantě.

## 1.4 Každý předmět má vlastní interakční jazyk

Sdílený Activity Engine poskytuje primitives a orchestration. Subject Engine poskytuje doménová pravidla.

Zakázaný pattern:

```text
univerzální quiz template
+ jiná barva
+ jiný subject label
```

Povolený pattern:

```text
shared orchestration
+ shared telemetry
+ shared accessibility contract
+ subject-specific interaction model
```

---

# 2. Statusy: CURRENT vs. VISION

Každá feature popsaná v blueprintu musí být interpretována podle statusu dokumentu v [`../README.md`](../README.md).

- `CURRENT / IMPLEMENTED` = lze očekávat v současném produktu.
- `VISION / APPROVED` = schválený cíl, nikoli tvrzení o existenci.

UI, sales materiály ani onboarding nesmějí prezentovat `VISION` funkce jako dostupné před jejich produkčním releasem.

---

# 3. Curriculum contract

## 3.1 Canonical vazba je na curriculum outcome, ne název předmětu

Škola může mít předmět:

- `Přírodopis`,
- `Přírodní vědy`,
- `Science`,
- vlastní integrovaný předmět.

Lesson Experience se proto primárně mapuje na immutable curriculum outcomes / jejich aspekty a až sekundárně na školní předmět, ročník a tematický celek.

Přesnou datovou semantiku určuje [`CURRICULUM-DATA-CONTRACT.md`](./CURRICULUM-DATA-CONTRACT.md).

## 3.2 Více curriculum verzí současně

Organizace **nesmí** mít jediný globální `curriculumVersion`, pokud může ve stejném školním roce vzdělávat různé ročníky podle různých verzí ŠVP/RVP.

Applicability musí být časově a scope-aware alespoň podle:

- academic year,
- grade,
- případně class section,
- framework release / school curriculum version.

## 3.3 Oficiální zdroje a provenance

Normativní RVP/OVU data se nesmí ručně opisovat bez provenance.

Každý importovaný framework release musí mít:

- stabilní interní ID,
- source authority,
- source URL/identifier,
- publication/effective dates, pokud jsou dostupné,
- acquisition/import timestamp,
- source version/revision,
- checksum nebo jiný immutable fingerprint snapshotu.

Aktualizace externího zdroje nesmí potichu změnit historické mapování.

## 3.4 Aktuálně ověřený český rámec

K datu posledního ověření:

- revidovaný RVP ZV pracuje s **10 vzdělávacími oblastmi** a OVU v uzlových bodech; authoritative source: `https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti`,
- povinné zahájení výuky podle revidovaného RVP ZV je od **1. 9. 2028 minimálně v 1. a 6. ročníku**, s postupným rozšířením do všech ročníků k **1. 9. 2032**; authoritative source: `https://revize.rvp.cz/zv/blog/harmonogram-implementace-rvp-zv`.

Tyto hodnoty nejsou hardcoded business constants. Jsou verzované curriculum metadata a před curriculum releasem se znovu ověřují.

---

# 4. Coverage contract

## 4.1 Zakázaná metrika: jedno neurčité „ŠVP progress %“

SkillStorm nesmí jedním procentem směšovat:

1. **content availability** — máme kvalitní obsah pro outcome/aspekt?
2. **curriculum mapping completeness** — je školní ŠVP namapovaný?
3. **delivery progress** — bylo učivo plánováno / odučeno?
4. **learning evidence** — co žáci skutečně prokázali?

Tyto čtyři dimenze mají odlišné významy, vlastní datové zdroje a vlastní UI labely.

## 4.2 `COVERED` není „existuje jedna aktivita“

Broad outcome může mít několik aspektů nebo evidence criteria. Stav `COVERED` smí vzniknout pouze po pedagogickém review, které doloží, že publikované Lesson Experiences společně poskytují dostatečnou možnost ověřit definované required aspects.

Normativní stavy:

- `MISSING` — žádné schválené pokrytí relevantního required aspectu,
- `PARTIAL` — některé required aspects jsou pokryté nebo evidence nestačí,
- `COVERED` — všechny required aspects definované coverage review jsou pokryté schváleným obsahem a existuje vhodný evidence path,
- `NOT_APPLICABLE` — outcome/aspekt se na daný school curriculum scope nevztahuje,
- `NEEDS_REVIEW` — mapping nebo obsah se změnil a coverage musí znovu schválit pedagog.

`RVP complete` je release claim a nesmí být odvozen pouze z topic tags.

---

# 5. Lesson Experience Definition of Ready

Lesson Experience nesmí přejít do implementace, pokud nemá minimálně:

- jasný learning objective,
- curriculum mapping nebo explicitní stav `UNMAPPED / PROTOTYPE`,
- pedagogický důvod, proč je interaktivní forma lepší než statický materiál,
- supported/recommended delivery modes,
- expected duration,
- interaction primitives / required engine,
- learning evidence plan,
- misconception / feedback strategy tam, kde je relevantní,
- accessibility plan,
- privacy/data plan,
- content safety review lane,
- asset/data provenance,
- offline/reconnect behavior,
- acceptance criteria.

Prototype bez curriculum mappingu může existovat interně, ale nesmí být publikován škole jako curriculum-covered content.

---

# 6. Lesson Experience Definition of Done

Produkční Lesson Experience je `DONE`, pouze pokud:

1. prošel pedagogickým review,
2. má schválené curriculum mappings,
3. všechny required assety mají právně použitelnou provenance/licenci,
4. accessibility testy pro supported modes jsou zelené,
5. privacy/security review je uzavřený,
6. content safety review je uzavřený, pokud se vyžaduje,
7. funguje na definované minimální device/browser matici,
8. má testovaný reconnect/resume behavior,
9. telemetry odpovídá semantic-event kontraktu,
10. learning evidence neinterpretujeme nad rámec toho, co aktivita skutečně měří,
11. učitel může aktivitu spustit bez vývojářských znalostí,
12. existuje rollback/fallback cesta při runtime problému.

---

# 7. Realtime a classroom orchestration

## 7.1 Semantic events only

Klient neposílá kontinuální pointer/frame stream pro běžné classroom telemetry.

Posílá významové eventy, například:

```text
COMPONENT_SELECTED
COMPONENT_PLACED
CHECKPOINT_COMPLETED
HINT_REQUESTED
MAP_LAYER_TOGGLED
PREDICTION_SUBMITTED
AUDIO_SEGMENT_COMPLETED
```

## 7.2 Event envelope

Každý persistovaný nebo serverově významný event musí mít alespoň:

```ts
{
  eventId: string;           // unique, idempotency key
  sessionId: string;
  participantId?: string;
  activityVersionId: string;
  type: string;
  schemaVersion: number;
  clientOccurredAt?: string;
  serverReceivedAt: string;
  payload: unknown;
}
```

Server musí:

- deduplikovat podle `eventId`,
- validovat `schemaVersion`,
- neodvozovat autoritativní pořadí pouze z klientského času,
- tolerovat reconnect a retry,
- odmítnout event pro cizí tenant/session.

## 7.3 Local-first interaction smoothness

Pohyb objektu, animace a většina okamžité UX odezvy probíhá lokálně.

Krátký výpadek Wi‑Fi nesmí způsobit zamrznutí celé aktivity, pokud pedagogická logika nevyžaduje serverový soud.

Kde je server autoritou (např. bezpečné reveal řešení), klient zobrazí explicitní pending/offline stav a nesmí si řešení dopočítat z dat, která před revealem nemá znát.

## 7.4 Reconnect contract

Každý `DEVICES`, `SHARED_DEVICES` a `HYBRID` runtime musí mít definováno:

- reconnect identity,
- resumable state,
- replay/deduplication eventů,
- max tolerated offline window,
- co se stane, když session mezitím teacher ukončil nebo posunul.

## 7.5 Board secrecy

Shared board/projection client nesmí předčasně dostat:

- správné odpovědi,
- solution snapshots,
- neveřejné hinty,
- jmenné informace o chybujících žácích,
- jiné údaje, které by mohly veřejně stigmatizovat jednotlivce.

---

# 8. Teacher control contract

Učitel je autorita classroom orchestration.

Podle typu aktivity musí mít možnost relevantně:

- start/pause/resume/finish,
- změnit podporovaný delivery mode před startem,
- zobrazit společný hint/explanation,
- přeskočit nebo zopakovat stage,
- poskytnout individuální pomoc bez veřejného označení žáka,
- override adaptivního doporučení,
- pochopit, proč systém doporučení provedl.

Adaptace nesmí být black box, který učiteli znemožní řídit hodinu.

---

# 9. Adaptivity contract

## 9.1 Difficulty != scaffolding

Odděleně persistujeme/konfigurujeme:

- cognitive complexity/difficulty,
- scaffolding/support.

Žák nesmí být automaticky degradován na jednodušší vzdělávací cíl jen proto, že potřebuje přístupovou nebo instruktážní podporu.

## 9.2 Explainable adaptation

První produkční adaptace má být deterministic/explainable.

Vhodné evidence:

- first-attempt correctness tam, kde dává smysl,
- počet relevantních misconception patterns,
- transfer challenge,
- hint usage,
- checkpoint evidence.

Nevhodné samostatné signály:

- rychlost klikání,
- obecná „aktivita“ myši,
- čas bez kontextu,
- inferred emotion/attention z kamery nebo mikrofonu.

## 9.3 Žádné citlivé diagnózy

SkillStorm nesmí z learning telemetry automaticky diagnostikovat nebo tvrdit:

- dyslexii,
- poruchu řeči,
- ADHD,
- zdravotní stav,
- emoce,
- mentální stav,
- identitu nebo etnicitu z hlasu/obrazu.

Pedagogický support profil je explicitní školní/učitelská konfigurace, nikoli skrytá medicínská inference.

---

# 10. Learning evidence contract

Learning evidence odpovídá pouze tomu, co aktivita skutečně dovolila pozorovat.

Příklad:

- `student placed RAM into correct DIMM slot` může být evidence pro konkrétní procedural objective,
- není to automaticky evidence, že „rozumí architektuře počítače“ jako celku.

Každý evidence type musí mít:

- objective/aspect reference,
- evidence type,
- source activity version,
- timestamp/session,
- evidence strength/interpretation policy,
- raw/derived distinction,
- provenance.

`mastery` není stejné jako `completion`.

---

# 11. Accessibility contract

## 11.1 Standard

Cílový technický standard webového UI je **WCAG 2.2 AA** v rozsahu, který je pro danou interaktivní funkci aplikovatelný. Authoritative reference: `https://www.w3.org/TR/WCAG22/`.

WCAG je baseline, nikoli strop pedagogické inkluze.

## 11.2 Povinné principy

- keyboard access všude, kde je to technicky relevantní,
- drag/drop musí mít alternativu typu select → target / buttons / keyboard,
- touch targety musí odpovídat board/mobile použití,
- žádná informace pouze barvou,
- instructional audio má transcript/captions,
- reduced motion,
- čitelné focus states,
- zoom/reflow bez ztráty kritické funkcionality,
- časový tlak lze vypnout tam, kde čas není měřený objective,
- instrukce lze podle activity profile zjednodušit nebo přečíst.

### Auditory-target exception

Pokud je samotným cílem rozlišit zvuk (např. délku samohlásky), nelze poskytnout vizuální ekvivalent a současně tvrdit, že měří stejnou sluchovou dovednost. V takovém případě:

- poskytneme přístupnou alternativní cestu k výuce,
- ale evidence musí mít odlišnou interpretaci.

---

# 12. Audio & microphone contract

## 12.1 Reference audio

Pokud je výslovnost, fonologie, rytmus nebo prosodie **předmětem učení**, reference audio musí být:

- kurátorované,
- jazykově/pedagogicky schválené,
- s doloženými právy použití,
- verzované.

Utility TTS je vhodné pro čtení běžných instrukcí nebo dynamického textu, nikoli automaticky jako jediný normativní výslovnostní vzor.

## 12.2 Mikrofon je opt-in capability

- žádný mikrofon permission prompt při běžném načtení SkillStormu,
- permission až při explicitním vstupu do microphone activity,
- absence mikrofonu nesmí blokovat základní audio-listening curriculum, pokud activity není explicitně production-oriented.

## 12.3 Raw child audio

Default:

> **raw audio žáka se nepersistuje.**

Pokud škola aktivuje funkci, která záznam ukládá, musí existovat explicitní data-processing konfigurace:

- účel,
- právní základ dle konkrétního deploymentu,
- retention,
- access control,
- export/delete workflow,
- audit log,
- transparentní UI.

Nelze univerzálně tvrdit, že „souhlas rodiče“ je vždy správný právní základ. Školy zpracovávají různé údaje i na základě zákonných povinností nebo veřejného zájmu; konkrétní účel musí být právně posouzen. Autoritativní český výchozí zdroj: `https://uoou.gov.cz/verejnost/qa-otazky-a-odpovedi/skolstvi`.

## 12.4 Pronunciation scoring

Automatický voice model nesmí sám vytvářet high-stakes známku.

Povolené:

- formative feedback,
- self-comparison,
- teacher-visible trend,
- explicitní teacher review.

Zakázané bez dalšího robustního validačního programu:

- „výslovnost 63 % = známka 3“,
- diagnostika vady řeči,
- penalizace akcentu bez pedagogického kontextu.

---

# 13. Privacy & GDPR contract

## 13.1 Data minimization

Každý nový field/event musí mít odpověď na:

> Proč ho potřebujeme pro konkrétní vzdělávací nebo provozní účel?

Pokud odpověď neexistuje, data se nesbírají.

## 13.2 Board-first anonymita

`BOARD_ONLY` aktivita má být anonymní na úrovni jednotlivých dětí všude, kde individualizovaná data nejsou nutná.

Veřejná projekce nikdy nesmí vytvářet:

- leaderboard slabých žáků,
- seznam „kdo nerozumí“,
- veřejné score jednotlivce bez explicitního bezpečného pedagogického designu.

## 13.3 Tenant isolation

Veškeré per-school curriculum, session, participant a evidence objekty musí být tenant-scoped. Cross-tenant request nesmí prozradit existenci cizího objektu tam, kde současný security model používá 404 concealment.

## 13.4 DPIA/privacy review lane

Feature s novým rozsáhlým/soustavným monitoringem dětského chování, raw audio/video nebo jiným zvýšeným privacy rizikem nesmí jít do produkce bez formálního privacy review a posouzení, zda je potřeba DPIA.

---

# 14. Security contract

Interactive Curriculum dědí všechny současné SkillStorm security invarianty:

- organization-scoped authorization,
- RBAC permission checks na serveru,
- žádná důvěra v client role claims,
- validation všech DTO/event payloadů,
- audit relevantních změn,
- secrets pouze přes environment/secret manager,
- rate limiting pro veřejné/join endpointy,
- bezpečné reconnect/join tokeny,
- žádné solution secrets v pre-reveal client payloadu.

Nový Activity Engine nesmí mít „rychlejší“ paralelní auth stack.

---

# 15. Content safety contract

Některé subject engines potřebují specializovaný review lane.

## 15.1 Chemie

Virtuální experiment nesmí dítěti poskytovat nebezpečný praktický návod nad rámec školsky bezpečného vzdělávacího obsahu. Reálné laboratorní kroky musí respektovat školní bezpečnostní pravidla a dohled učitele.

## 15.2 Fyzika / technika

Elektrické, mechanické a dílenské scénáře musí jasně odlišit simulaci od bezpečného provedení v reálné třídě.

## 15.3 Zdraví / první pomoc

Medicínsky nebo bezpečnostně významné instrukce musí mít odborný review a verzi zdroje; nesmějí být generovány ad hoc AI bez validace.

## 15.4 Občanství / politika / dějepis

Scénáře musí rozlišovat:

- fakt,
- pramen,
- interpretaci,
- argument,
- modelovou situaci.

Platforma nesmí být stranickým přesvědčovacím nástrojem.

---

# 16. Asset & data provenance

Každý produkční asset/dataset musí mít známý původ.

Týká se zejména:

- mapových dat,
- audio nahrávek,
- fotografií,
- videí,
- 3D modelů,
- ilustrací,
- fontů,
- historických pramenů,
- externích datasetů.

Metadata minimálně:

```text
source
license / rights basis
attribution requirement
version / acquisition date
allowed commercial use
modification restrictions
```

Pro PC Lab jsou defaultem **generické/SkillStorm komponenty bez cizích log a chráněných produktových renderů**, dokud není licenční základ explicitně vyřešen.

---

# 17. Performance & resilience contract

## 17.1 Classroom target

Design musí počítat minimálně s běžnou třídou kolem 30 současných účastníků bez potřeby streamovat obrazovku nebo pointer events.

## 17.2 Preload

Lesson Experience musí před startem umět ověřit/dotáhnout required assety a zobrazit readiness stav učiteli.

Učitel nemá zjistit až v půlce hodiny, že 80MB asset chybí.

## 17.3 Network degradation

Každý mode definuje:

- co funguje lokálně bez sítě,
- co čeká na server,
- co se queueuje,
- co se po reconnectu deduplikuje,
- jaký fallback dostane učitel.

## 17.4 Graceful fallback

Pokud komplexní renderer selže, učitel má mít podle activity designu možnost:

- refresh/rejoin,
- přeskočit stage,
- přepnout na board explanation,
- pokračovat alternativním materiálem.

Žádná jediná vizuální efektní komponenta nesmí být single point of failure celé 45min hodiny.

---

# 18. Browser/device support

Před produkcí se udržuje explicitní support matrix.

Minimálně testujeme relevantní kombinace:

- moderní Chromium-based desktop browser,
- Safari/iPadOS tam, kde podporujeme tablet,
- dotyková interaktivní tabule přes Pointer Events,
- keyboard-only path,
- běžné školní rozlišení a zoom.

Použití API jako microphone, WebGL/WebGPU nebo AudioWorklet musí mít capability detection a definovaný fallback.

---

# 19. Observability contract

Runtime musí odlišovat:

- product/pedagogical telemetry,
- operational telemetry,
- security/audit events.

Operational monitoring musí umět zjistit minimálně:

- session start failure,
- asset load failure,
- reconnect storm,
- elevated event rejection rate,
- renderer crash/error,
- backend latency/error rate.

Žádné PII nesmí být zbytečně kopírováno do error logs.

---

# 20. Testing contract

## 20.1 Unit / contract tests

Povinné pro:

- deterministic domain rules,
- compatibility engines,
- curriculum coverage calculations,
- event validation/idempotency,
- accessibility helper logic,
- reveal/secrecy projection.

## 20.2 Integration/e2e

Každý production vertical slice musí testovat celý příběh:

```text
teacher create/start
→ participant/board join
→ activity actions
→ telemetry
→ teacher intervention
→ reconnect
→ finish
→ learning evidence
```

## 20.3 Real browser

Touch/drag/audio/canvas/WebGL chování se neověřuje jen unit testy. Potřebuje real-browser scénář na podporované matici.

## 20.4 Accessibility verification

Automatický a11y scanner nestačí. Produkční gate obsahuje také manuální keyboard/touch/screen-reader sanity check podle typu aktivity.

---

# 21. AI contract

AI může pomáhat:

- navrhovat content drafts,
- hledat relevantní curriculum mappings,
- generovat varianty feedbacku,
- sumarizovat anonymizované třídní patterns.

AI nesmí bez human review:

- publikovat normativní curriculum mapping,
- vydávat zdravotní/psychologickou diagnózu,
- automaticky měnit známku v high-stakes kontextu,
- vytvářet neověřený bezpečnostní/chemický/medicínský návod,
- měnit school curriculum source of truth.

V UI musí být možné rozlišit doporučení systému od schváleného školního/kurikulárního faktu.

---

# 22. Teacher UX production gate

Hlavní lesson flow nesmí vyžadovat znalost interních termínů typu `ActivityVersion`, `OutcomeMapping` nebo `DeliveryMode enum`.

Teacher-facing cíl:

```text
otevřu třídu
→ vidím, co podle ŠVP řeším
→ vyberu doporučenou hodinu
→ případně změním způsob práce
→ spustím
```

Před releasem nové experience family proběhne teacher usability test zaměřený minimálně na:

- time to start,
- pochopení režimu,
- schopnost zotavit se z chyby,
- čitelnost Mission Control/boardu,
- reálné zatížení přípravy.

---

# 23. Release claims

Následující marketingové/product claims mají technický gate:

## `Production ready`

Pouze pokud prošly relevantní security, privacy, accessibility, resilience, browser a pedagogical gates.

## `RVP aligned`

Pouze pokud existuje schválené mapping review k uvedené framework release.

## `RVP complete`

Pouze pokud machine-readable coverage audit neobsahuje relevantní `MISSING`, všechny `PARTIAL/NEEDS_REVIEW` jsou vyřešeny podle definovaného scope a pedagogický reviewer schválil release.

## `Works without student devices`

Pouze pro experiences, které mají otestovaný `BOARD_ONLY` nebo odpovídající fallback.

## `Accessible`

Pouze s uvedeným scope/support matrix; samotná existence alt textu není důkazem WCAG 2.2 AA.

---

# 24. Production readiness checklist pro nový engine

Nový engine (např. Map, Chem, Physics, Audio) nesmí být označen jako production-ready bez uzavření těchto kategorií:

```text
[ ] domain model
[ ] versioning
[ ] authoring validation
[ ] asset/data provenance
[ ] renderer capability/fallback
[ ] BOARD/SHARED/DEVICES/HYBRID matrix
[ ] semantic telemetry
[ ] reconnect/resume/idempotency
[ ] teacher controls
[ ] learning evidence semantics
[ ] curriculum mapping
[ ] accessibility
[ ] privacy
[ ] security
[ ] content safety
[ ] observability
[ ] automated tests
[ ] real-browser tests
[ ] teacher usability validation
[ ] pilot evidence
[ ] rollback/fallback
```

---

# 25. Závazná anti-goals

SkillStorm Interactive Curriculum nesmí sklouznout k:

- přepisování učebnic na obrazovku,
- leaderboardům založeným na veřejném selhání dětí,
- sběru dat „protože se jednou mohou hodit“,
- AI hodnocení bez interpretovatelnosti a human override,
- hardcoded vazbě „předmět + ročník = jediná pravda“,
- závislosti na 30 tabletech,
- jednorázovým hardcoded hrám bez reusable engine kontraktu,
- používání reálných brand assetů bez práv,
- zaměňování completion za mastery,
- zaměňování content coverage za skutečně odučené nebo zvládnuté curriculum,
- feature developmentu bez acceptance criteria a release gate.

---

# 26. Change control

Změna tohoto Production Contractu je architektonické rozhodnutí.

PR musí explicitně uvést:

- který invariant se mění,
- proč,
- které dokumenty/kód/testy jsou ovlivněny,
- migration/backward-compatibility dopad,
- zda změna ovlivňuje privacy/security/curriculum claims.

Dokument se nesmí „potichu“ měnit jen proto, aby odpovídal již napsanému kódu.

---

# 27. Výsledek

Pokud se blueprint a tento kontrakt liší, implementace se zastaví a rozpor se vyřeší **před kódováním**.

To je záměr.

SkillStorm má být odvážný v produktu, ale nudně přesný v production invariants.