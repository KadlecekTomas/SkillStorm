# SkillStorm Documentation Registry

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Purpose:** jediný registr autority, životního cyklu a precedence lidské dokumentace v repozitáři.

---

## 1. Proč tento registr existuje

SkillStorm má vedle implementačních kontraktů také produktové vize, provozní runbooky, bezpečnostní specifikace, roadmapy, starší audity a historické devlogy. Bez jasné hierarchie může být každý jednotlivý dokument sám o sobě srozumitelný, ale dva dokumenty mohou popisovat jiný časový okamžik nebo jinou cílovou architekturu.

Proto platí:

> **Dokument bez statusu v tomto registru není automaticky současný zdroj pravdy.**

Tento registr určuje, které dokumenty jsou normativní pro nový vývoj, které popisují současnou implementaci, které jsou provozními runbooky a které jsou pouze historickým důkazem rozhodnutí nebo stavu.

---

# 2. Statusy dokumentů

| Status | Význam | Smí řídit nový vývoj? |
| --- | --- | --- |
| `CURRENT / NORMATIVE` | závazný současný kontrakt nebo source of truth | **ano** |
| `CURRENT / IMPLEMENTED` | popis současné implementace; změna vyžaduje aktualizaci kódu i dokumentu | **ano, pro existující funkcionalitu** |
| `CURRENT / RUNBOOK` | provozní postup ověřený proti současnému repozitáři | **ano, pro provoz** |
| `VISION / APPROVED` | schválený cílový směr; nemusí být implementován | **ano, pro plánovaný vývoj** |
| `DESIGN / ACTIVE` | aktivní návrh, který musí respektovat normativní kontrakty | **ano, po ověření dependencies** |
| `HISTORICAL / SNAPSHOT` | audit, devlog nebo stav platný v minulosti | **ne** |
| `SUPERSEDED` | nahrazen novějším dokumentem | **ne** |

Pokud je status souboru v jeho vlastním textu v konfliktu s tímto registrem, **platí tento registr**, dokud není konflikt vědomě vyřešen změnou obou míst v jednom PR.

---

# 3. Precedence — co vyhrává při konfliktu

Při rozporu dokumentů se postupuje v tomto pořadí:

1. **bezpečnostní, privacy a tenant isolation invarianty v aktuálním kódu + normativních security kontraktech,**
2. [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md),
3. [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) pro RVP/ŠVP/coverage data,
4. [`roadmap/master.md`](./roadmap/master.md) pro pořadí vývoje,
5. současné implementační kontrakty konkrétní funkcionality,
6. schválené product/subject blueprints,
7. aktivní design dokumenty,
8. historické snapshoty a superseded dokumenty — **nikdy nejsou autoritou pro nový vývoj**.

### Kritické pravidlo

`VISION / APPROVED` nesmí být vydávána za již implementovanou funkcionalitu. Naopak současná implementace nesmí být automaticky považována za cílovou architekturu, pokud normativní kontrakt říká, že se má evolučně změnit.

---

# 4. Aktivní source of truth

## 4.1 Produkt a kurikulum

| Dokument | Status | Autorita |
| --- | --- | --- |
| [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md) | `CURRENT / NORMATIVE` | cross-cutting production invarianty pro všechny budoucí Lesson Experiences a enginy |
| [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) | `CURRENT / NORMATIVE` | curriculum versioning, RVP/ŠVP mapping, immutable provenance, coverage a learning-evidence semantics |
| [`interactive-curriculum/README.md`](./interactive-curriculum/README.md) | `VISION / APPROVED` | nadřazená produktová vize Interactive Curriculum |
| [`interactive-curriculum/USE-CASES.md`](./interactive-curriculum/USE-CASES.md) | `VISION / APPROVED` | katalog pedagogických use cases 1.–9. ročníku |
| [`interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md`](./interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md) | `VISION / APPROVED` | product UX a coverage blueprint; datová semantika podléhá `CURRICULUM-DATA-CONTRACT.md` |
| [`interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md`](./interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md) | `VISION / APPROVED` | Audio & Language Engine a recommended ČJ progression |
| [`interactive-it-lab/README.md`](./interactive-it-lab/README.md) | `VISION / APPROVED` | první detailní subject blueprint — Interactive IT Lab |
| [`roadmap/master.md`](./roadmap/master.md) | `CURRENT / NORMATIVE` | jediné závazné pořadí produktového a technického vývoje |

## 4.2 Současné implementační kontrakty

| Dokument | Status | Poznámka |
| --- | --- | --- |
| [`live-sessions.md`](./live-sessions.md) | `CURRENT / IMPLEMENTED` | dnešní Bleskovky / `BOARD_ONLY`; `DEVICES` není tímto dokumentem prohlášeno za implementované |
| [`live-sessions-interactions.md`](./live-sessions-interactions.md) | `CURRENT / IMPLEMENTED` | současná board drag/drop kola |
| [`submissions-concurrency.md`](./submissions-concurrency.md) | `CURRENT / IMPLEMENTED` | concurrency invarianty submissions |
| [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) | `CURRENT / IMPLEMENTED` | tenant/RBAC testovací kontrakt |
| [`gdpr-sso-identity.md`](./gdpr-sso-identity.md) | `CURRENT / IMPLEMENTED` | identity/GDPR kontrakty v rozsahu současné implementace |
| [`google-sso-architecture.md`](./google-sso-architecture.md) | `CURRENT / IMPLEMENTED` | Google SSO architektura; měnit spolu s auth implementací |
| [`partak-rules.md`](./partak-rules.md) | `CURRENT / IMPLEMENTED` | pravidla Parťáka |
| [`campaigns.md`](./campaigns.md) | `CURRENT / IMPLEMENTED` | kampaně |
| [`campaigns-decisions.md`](./campaigns-decisions.md) | `CURRENT / IMPLEMENTED` | rozhodnutí ke kampaním |
| [`ci.md`](./ci.md) | `CURRENT / IMPLEMENTED` | CI kontrakt; skutečný workflow soubor má při nesouladu technickou přednost a dokument se musí opravit |

### Live Sessions vs. Activity Engine

Současné Bleskovky používají `Test`/`Question` jako zdroj části obsahu. To **není precedent**, že budoucí simulace, Map Lab, Chem Lab, Audio Lab nebo Build-a-PC mají být modelovány jako `Test`/`Question`. Pro Interactive Curriculum platí oddělený Activity/Lesson Experience model definovaný normativními kontrakty.

---

# 5. Provozní runbooky

| Dokument | Status | Podmínka autority |
| --- | --- | --- |
| [`ops/backup-restore.md`](./ops/backup-restore.md) | `CURRENT / RUNBOOK` | musí být pravidelně ověřován restore drill-em |
| [`ops/monitoring-alerting.md`](./ops/monitoring-alerting.md) | `CURRENT / RUNBOOK` | musí odpovídat aktuálním monitoring službám |
| [`ops/query-performance.md`](./ops/query-performance.md) | `CURRENT / RUNBOOK` | musí odpovídat produkční DB strategii |
| [`testing/test-db-isolation.md`](./testing/test-db-isolation.md) | `CURRENT / RUNBOOK` | kontrakt izolace testovací DB |
| [`working-with-claude.md`](./working-with-claude.md) | `CURRENT / RUNBOOK` | vývojový workflow; nesmí přepisovat product/security precedence |
| [`screenshots/INDEX.md`](./screenshots/INDEX.md) | `CURRENT / RUNBOOK` | index screenshot artefaktů, nikoli produktová specifikace |
| [`server/test/e2e-legacy/README.md`](../server/test/e2e-legacy/README.md) | `HISTORICAL / SNAPSHOT` | dokumentace legacy testů; nesmí definovat nový testovací standard |

---

# 6. Aktivní design dokumenty

Tyto dokumenty mohou obsahovat hodnotné návrhy, ale nesmějí přepsat normativní kontrakty nebo současné security invarianty.

| Dokument | Status |
| --- | --- |
| [`analytics/analysis-design.md`](./analytics/analysis-design.md) | `DESIGN / ACTIVE` |
| [`analytics/analysis-phase2.md`](./analytics/analysis-phase2.md) | `DESIGN / ACTIVE` |
| [`analytics/prisma-models.md`](./analytics/prisma-models.md) | `DESIGN / ACTIVE` |
| [`guardian-project.md`](./guardian-project.md) | `DESIGN / ACTIVE` |
| [`guardian-spec.md`](./guardian-spec.md) | `DESIGN / ACTIVE` |
| [`guardian.md`](./guardian.md) | `DESIGN / ACTIVE` |
| [`guardian/etapa-1-retrieval-foundation.md`](./guardian/etapa-1-retrieval-foundation.md) | `DESIGN / ACTIVE` |
| [`guardian/etapa-2-realtime-capture.md`](./guardian/etapa-2-realtime-capture.md) | `DESIGN / ACTIVE` |
| [`guardian/etapa-3-context-broker-consumer-enablement.md`](./guardian/etapa-3-context-broker-consumer-enablement.md) | `DESIGN / ACTIVE` |

Před implementací větší části z `DESIGN / ACTIVE` dokumentu se musí ověřit, že nebyl mezitím superseded změnou schématu, security modelu nebo Master Roadmap.

---

# 7. Historické a superseded dokumenty

Následující soubory jsou **důkazem minulého stavu nebo dřívější teze**. Zachováváme je kvůli traceability; nejsou vstupem pro nový vývoj bez nové revize.

| Dokument | Status | Proč není autoritou |
| --- | --- | --- |
| [`roadmap/doctrine.md`](./roadmap/doctrine.md) | `SUPERSEDED` | původní `EDUTO` / School Intelligence & Workflow Layer teze; aktuální produktová hierarchie je Interactive Curriculum + Master Roadmap |
| [`roadmap/2026-07-napadnik.md`](./roadmap/2026-07-napadnik.md) | `HISTORICAL / SNAPSHOT` | brainstorm z konkrétního období |
| [`production-roadmap.md`](./production-roadmap.md) | `HISTORICAL / SNAPSHOT` | starší production roadmap; pořadí určuje `roadmap/master.md` |
| [`production-audit.md`](./production-audit.md) | `HISTORICAL / SNAPSHOT` | audit stavu k určitému commitu/času |
| [`production-sso-hardening-audit.md`](./production-sso-hardening-audit.md) | `HISTORICAL / SNAPSHOT` | audit SSO hardeningu k určitému stavu |
| [`ops/production-readiness.md`](./ops/production-readiness.md) | `HISTORICAL / SNAPSHOT` | obsahuje datum 2025, staré názvy DB/branchí a lokální cesty; **nepoužívat jako současný deployment runbook** |
| [`testing/e2e-baseline-audit.md`](./testing/e2e-baseline-audit.md) | `HISTORICAL / SNAPSHOT` | baseline audit konkrétního stavu |
| [`visual-qa-findings.md`](./visual-qa-findings.md) | `HISTORICAL / SNAPSHOT` | nálezy k určitému UI snapshotu |
| [`devlog/2026-07-13-heterogeneous-classrooms.md`](./devlog/2026-07-13-heterogeneous-classrooms.md) | `HISTORICAL / SNAPSHOT` | devlog; nikoli current contract |

Historický dokument může být znovu povýšen pouze explicitní revizí a změnou statusu v tomto registru.

---

# 8. Jediná aktivní produktová teze

SkillStorm má dvě vrstvy, které se doplňují, nikoli dvě konkurenční identity:

```text
CURRICULUM-AWARE CLASSROOM EXPERIENCE
co a jak se ve třídě učí

        ↓ learning evidence / workflow

SCHOOL INTELLIGENCE & OPERATIONS
jak škola výuku organizuje, sleduje a administruje
```

Primární diferenciace nového produktu je:

> **SkillStorm převádí RVP/ŠVP školy na kvalitní Lesson Experiences, které lze spustit podle reálného vybavení třídy a které vytvářejí ověřitelný learning evidence.**

Workflow, analytika, importy, RBAC a administrativa tuto zkušenost umožňují; nejsou samostatnou konkurenční severkou.

---

# 9. Povinná metadata nových autoritativních dokumentů

Nový `CURRENT / NORMATIVE`, `CURRENT / IMPLEMENTED` nebo `CURRENT / RUNBOOK` dokument musí nahoře uvádět minimálně:

```text
Status
Owner
Last verified
Purpose / Scope
```

Pokud dokument závisí na vnějším standardu nebo kurikulu, musí navíc uvést:

- authoritative source,
- datum nebo release/verzi zdroje,
- datum posledního ověření,
- případně immutable snapshot/checksum v machine-readable vrstvě.

---

# 10. Dokumentační Definition of Done

Dokumentace je připravena k implementaci jen tehdy, když:

- nemá konkurenční source of truth,
- jasně odlišuje `CURRENT` od `VISION`,
- používá jednotnou terminologii,
- neobsahuje lokální absolutní cesty, demo secrets ani zastaralé instrukce vydávané za current,
- její datový model podporuje uvedené use cases bez vnitřního rozporu,
- bezpečnostní/privacy/accessibility invarianty jsou explicitní,
- externí normativní tvrzení mají dohledatelný authoritative source,
- každý release claim typu `RVP complete`, `production ready` nebo `accessible` má definovaný ověřovací gate,
- změna implementace aktualizuje příslušný dokument ve stejném PR.

---

# 11. Maintenance policy

- `roadmap/master.md` revidovat po dokončení každé implementační fáze.
- Curriculum authoritative sources kontrolovat při každém oficiálním release/změně RVP a před každým curriculum-content release.
- Runbooky ověřovat praktickým drillem, ne pouze čtením.
- Historické audity nikdy „potichu“ nepřepisovat na současnost.
- Změna normativního kontraktu musí mít vlastní explicitní commit/PR popis.

Tento registr je součástí production gate dokumentace SkillStormu.