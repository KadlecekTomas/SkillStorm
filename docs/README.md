# SkillStorm Documentation Registry

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** jediný registr autority, životního cyklu a precedence lidské Markdown dokumentace v repozitáři.

---

## 1. Proč tento registr existuje

SkillStorm obsahuje současné implementační kontrakty, provozní runbooky, schválené budoucí blueprinty i historické audity a návrhy.

Bez explicitního statusu může starý dokument vypadat stejně autoritativně jako dnešní kontrakt. Proto platí:

> **Markdown není source of truth jen proto, že existuje. Autoritu určuje tento registr + status dokumentu + executable code/test contract tam, kde dokument popisuje současnou implementaci.**

Každý lidsky udržovaný `.md` soubor zahrnutý do `npm run docs:validate` musí být v tomto registru veden přes svou skutečnou cestu.

---

# 2. Statusy

| Status | Význam | Smí řídit nový vývoj? |
| --- | --- | --- |
| `CURRENT / NORMATIVE` | závazný současný kontrakt / source of truth | **ano** |
| `CURRENT / NORMATIVE SECURITY CONTRACT` | závazný bezpečnostní release kontrakt | **ano** |
| `CURRENT / IMPLEMENTED` | přesný popis současné implementace | **ano, pro existující funkcionalitu** |
| `CURRENT / IMPLEMENTED — PILOT ONLY` | implementováno, ale explicitně ne production enterprise capability | **ano, pouze v popsaném pilotním rozsahu** |
| `CURRENT / RUNBOOK` | současný provozní/vývojový postup | **ano, pro danou operaci** |
| `VISION / APPROVED` | schválený cílový směr, nemusí být implementován | **ano, pro plánovaný vývoj** |
| `VISION / PARKED` | vědomě odložená hypotéza, bez implementační priority | **ne, dokud ji Master Roadmap nepovýší** |
| `HISTORICAL / ADR` | historický záznam rozhodnutí | **ne; pouze vysvětluje minulou volbu** |
| `HISTORICAL / SNAPSHOT` | audit/plán/devlog k minulému stavu | **ne** |
| `SUPERSEDED` | nahrazen současným dokumentem | **ne** |

Pokud se status ve vlastním souboru liší od registru, je to dokumentační chyba, která se má opravit ve stejném PR. Do té doby má pro klasifikaci přednost tento registr.

---

# 3. Precedence

Při konfliktu platí v tomto pořadí:

1. bezpečnostní/privacy/tenant invarianty v aktuálním kódu, databázových guardech a normativních security kontraktech;
2. [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md);
3. [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) pro curriculum/versioning/coverage/evidence;
4. [`roadmap/master.md`](./roadmap/master.md) pro pořadí vývoje;
5. současné implementační kontrakty dané domény;
6. `VISION / APPROVED` blueprinty;
7. `VISION / PARKED`, historické a superseded soubory — nikdy automaticky neřídí implementaci.

### Kritická hranice

`VISION` se nesmí prezentovat jako hotová funkcionalita. Stejně tak současný legacy/compatibility model není automaticky cílová architektura, pokud normativní kontrakt definuje evoluci.

---

# 4. Aktivní normativní a produktové dokumenty

| Dokument | Status | Autorita |
| --- | --- | --- |
| [`roadmap/master.md`](./roadmap/master.md) | `CURRENT / NORMATIVE` | jediné závazné pořadí produktového a technického vývoje |
| [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md) | `CURRENT / NORMATIVE` | cross-cutting production invarianty Lesson Experiences / Activity Engine / classroom orchestration |
| [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) | `CURRENT / NORMATIVE` | RVP/ŠVP versioning, mapping, provenance, coverage a learning evidence |
| [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) | `CURRENT / NORMATIVE SECURITY CONTRACT` | negativní tenant/RBAC evidence a school-production security gate |
| [`interactive-curriculum/README.md`](./interactive-curriculum/README.md) | `VISION / APPROVED` | hlavní produktová vize Interactive Curriculum |
| [`interactive-curriculum/USE-CASES.md`](./interactive-curriculum/USE-CASES.md) | `VISION / APPROVED` | pedagogický use-case katalog |
| [`interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md`](./interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md) | `VISION / APPROVED` | school-curriculum UX a coverage blueprint; datová semantika podléhá Curriculum Data Contractu |
| [`interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md`](./interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md) | `VISION / APPROVED` | Audio & Language Engine blueprint |
| [`interactive-it-lab/README.md`](./interactive-it-lab/README.md) | `VISION / APPROVED` | subject blueprint Interactive IT Lab |
| [`roadmap/partak-2.0.md`](./roadmap/partak-2.0.md) | `VISION / PARKED` | volitelná budoucí Parťák 2.0 hypotéza; bez implementační priority do pilot evidence |

---

# 5. Současné implementační kontrakty

| Dokument | Status | Poznámka |
| --- | --- | --- |
| [`guardian.md`](./guardian.md) | `CURRENT / IMPLEMENTED` | současné Guardian identity, PARENT invarianty a relation-scoped access |
| [`live-sessions.md`](./live-sessions.md) | `CURRENT / IMPLEMENTED` | dnešní Bleskovky, primárně `BOARD_ONLY`; `DEVICES` je future seam |
| [`live-sessions-interactions.md`](./live-sessions-interactions.md) | `CURRENT / IMPLEMENTED` | současná interaktivní board kola a solution-secrecy contract |
| [`submissions-concurrency-and-locking.md`](./submissions-concurrency-and-locking.md) | `CURRENT / IMPLEMENTED` | classic Test/Assignment/Submission concurrency a locking |
| [`partak-rules.md`](./partak-rules.md) | `CURRENT / IMPLEMENTED` | ClassParták participation-only XP contract |
| [`campaigns.md`](./campaigns.md) | `CURRENT / IMPLEMENTED` | současné Campaigns nad Live Sessions |
| [`ci.md`](./ci.md) | `CURRENT / IMPLEMENTED` | CI topology a release-check semantics; workflow YAML je executable authority |
| [`google-sso-architecture.md`](./google-sso-architecture.md) | `CURRENT / IMPLEMENTED — PILOT ONLY` | feature-flagged Google ID-token pilot; ne enterprise production SSO |
| [`gdpr-sso-identity.md`](./gdpr-sso-identity.md) | `CURRENT / IMPLEMENTED — PILOT ONLY` | technický privacy contract současného SSO pilotu; ne právní povolení k produkčnímu zapnutí |

### Důležité hranice

- současné Bleskovky mohou používat `Test`/`Question`, ale to není precedent pro budoucí simulace/Activity Engine;
- `PARENT` přístup je relationship-scoped podle [`guardian.md`](./guardian.md), nikoli generický RBAC grant;
- classic `Submission` evidence se nesmí bez explicitní migrace vydávat za cílový Activity semantic-event model.

---

# 6. Current runbooky

| Dokument | Status | Podmínka autority |
| --- | --- | --- |
| [`ops/backup-restore.md`](./ops/backup-restore.md) | `CURRENT / RUNBOOK` | ověřovat skutečným restore drillem |
| [`ops/monitoring.md`](./ops/monitoring.md) | `CURRENT / RUNBOOK` | musí odpovídat aktuálním health/Sentry/logging implementacím a deployment alertům |
| [`testing/test-database-isolation.md`](./testing/test-database-isolation.md) | `CURRENT / RUNBOOK` | destructive test DB guard; kódový whitelist má technickou přednost |
| [`working-with-claude.md`](./working-with-claude.md) | `CURRENT / RUNBOOK` | tool-neutral AI-assisted engineering workflow; podřízen security/product precedence |

Poznámka: `docs/screenshots/` obsahuje obrazové artefakty, nikoli lidský Markdown source of truth; proto nemá vymyšlený `INDEX.md` entry.

---

# 7. Historické / neautoritativní dokumenty

Tyto soubory se zachovávají kvůli traceability. Nesmějí být použity jako implementační zadání bez nové revize proti current contracts.

| Dokument | Status | Současná náhrada / význam |
| --- | --- | --- |
| [`campaigns-decisions.md`](./campaigns-decisions.md) | `HISTORICAL / ADR` | vysvětluje původní Campaign decisions; current behavior je v `campaigns.md` |
| [`roadmap/doctrine.md`](./roadmap/doctrine.md) | `SUPERSEDED` | stará Eduto doctrine; current hierarchy je registry + Master + Interactive Curriculum contracts |
| [`roadmap/2026-07-napadnik.md`](./roadmap/2026-07-napadnik.md) | `HISTORICAL / SNAPSHOT` | dobový brainstorm |
| [`production-roadmap.md`](./production-roadmap.md) | `HISTORICAL / SNAPSHOT` | starší roadmap; pořadí určuje `roadmap/master.md` |
| [`production-audit.md`](./production-audit.md) | `HISTORICAL / SNAPSHOT` | audit konkrétního staršího stavu |
| [`production-sso-hardening-audit.md`](./production-sso-hardening-audit.md) | `HISTORICAL / SNAPSHOT` | starší SSO hardening audit; current pilot contract je v SSO docs |
| [`ops/production-readiness.md`](./ops/production-readiness.md) | `HISTORICAL / SNAPSHOT` | starší deployment/readiness snapshot; nepoužívat jako current runbook |
| [`ops/query-limits-audit.md`](./ops/query-limits-audit.md) | `HISTORICAL / SNAPSHOT` | jednorázový `findMany` audit/benchmark z 2026-07-14; není performance SLO/runbook |
| [`testing/e2e-baseline-audit.md`](./testing/e2e-baseline-audit.md) | `HISTORICAL / SNAPSHOT` | dobový E2E baseline audit |
| [`visual-qa-findings.md`](./visual-qa-findings.md) | `HISTORICAL / SNAPSHOT` | nálezy k určitému UI snapshotu |
| [`devlog/2026-06-17-focus-test.md`](./devlog/2026-06-17-focus-test.md) | `HISTORICAL / SNAPSHOT` | dobový devlog/focus test |
| [`analytics/student-progress-analysis.md`](./analytics/student-progress-analysis.md) | `HISTORICAL / SNAPSHOT` | starší analytics RFC; nové mastery/evidence návrhy musí vycházet z Curriculum Data Contractu |
| [`analytics/student-progress-phase-2-plan.md`](./analytics/student-progress-phase-2-plan.md) | `HISTORICAL / SNAPSHOT` | starší Phase 2 plán; není current backlog |
| [`analytics/student-progress-prisma-models.md`](./analytics/student-progress-prisma-models.md) | `HISTORICAL / SNAPSHOT` | starý model sketch; nesmí se kopírovat do Prisma bez nové revize |
| [`guardian-project.md`](./guardian-project.md) | `HISTORICAL / SNAPSHOT` | původní etapový plán Guardianu; current security contract je `guardian.md` |
| [`guardian-spec.md`](./guardian-spec.md) | `HISTORICAL / SNAPSHOT` | původní Guardian specifikace |
| [`guardian/etapa-a-analyza.md`](./guardian/etapa-a-analyza.md) | `HISTORICAL / SNAPSHOT` | dobová Etapa A analýza |
| [`guardian/etapa-b-stop2-navrh.md`](./guardian/etapa-b-stop2-navrh.md) | `HISTORICAL / SNAPSHOT` | dobový STOP2 návrh |
| [`guardian/etapa-c-stop3-navrh.md`](./guardian/etapa-c-stop3-navrh.md) | `HISTORICAL / SNAPSHOT` | dobový STOP3 návrh |
| [`../server/test/e2e-legacy/README.md`](../server/test/e2e-legacy/README.md) | `HISTORICAL / SNAPSHOT` | dokumentace legacy/quarantined suite; není release gate |

Historické soubory mohou obsahovat přesné informace o minulém stavu. To není povolení přenášet jejich čísla, cesty, modely, branches nebo env názvy do současného kódu.

---

# 8. Jediná aktivní produktová teze

SkillStorm má propojené, nikoli konkurenční vrstvy:

```text
CURRICULUM-AWARE CLASSROOM EXPERIENCE
co a jak se ve třídě učí

        ↓ evidence / orchestration

SCHOOL INTELLIGENCE & OPERATIONS
jak škola výuku bezpečně organizuje a vyhodnocuje
```

Primární produktová diferenciace nového směru je:

> **SkillStorm převádí versioned RVP/ŠVP kontext školy na kvalitní Lesson Experiences použitelné s reálným vybavením třídy a na learning evidence, jehož původ lze zpětně vysvětlit.**

---

# 9. Povinná metadata

Každý nový nebo revidovaný autoritativní dokument (`CURRENT`, `VISION / APPROVED`, `VISION / PARKED`) musí nahoře uvádět minimálně:

```text
Status
Owner
Last verified/reviewed
Scope/Purpose
```

Historický soubor má být v registru explicitně klasifikovaný; při významném hardeningu preferujeme navíc viditelný historical/superseded banner přímo v souboru.

Dokument závislý na externím standardu/kurikulu musí uvést autoritativní zdroj a datum/release posledního ověření. Machine-readable import navíc ukládá provenance/fingerprint podle Curriculum Data Contractu.

---

# 10. Documentation Definition of Done

Dokumentace je připravena jako vstup do vývoje pouze pokud:

```text
[ ] všechny human-authored Markdowny jsou přesnou cestou registrovány
[ ] registry neobsahuje odkazy na neexistující Markdown soubory
[ ] current docs nemají konkurenční source of truth
[ ] CURRENT vs VISION vs HISTORICAL je jednoznačné
[ ] current docs neobsahují aktivní Eduto branding, machine-local paths ani demo secrets
[ ] normative data/security terms jsou konzistentní
[ ] externí normativní tvrzení mají dohledatelný authoritative source
[ ] production/accessibility/RVP-complete claims mají definovaný evidence gate
[ ] změna implementace aktualizuje příslušný CURRENT contract ve stejném PR
[ ] npm run docs:validate prochází
[ ] Documentation Integrity GitHub Action prochází
```

Passing Markdown validation neznamená, že celý SkillStorm je production-ready. Znamená, že **dokumentace je interně mechanicky konzistentní a pravdivě klasifikuje známé implementation/release blockers**.

---

# 11. Maintenance policy

- `roadmap/master.md` revidovat po dokončení implementační fáze/milníku.
- RVP/ŠVP authoritative sources ověřit před curriculum-content release a při změně upstream zdroje.
- runbook ověřovat praktickým drillem/testem, ne pouze přečtením;
- historical snapshot nikdy potichu nepovýšit na current;
- nový `.md` zaregistrovat ve stejném PR;
- přejmenování/mazání `.md` musí opravit všechny relativní odkazy a registry;
- normativní contract change musí být explicitní a reviewable.

---

## Final invariant

> **V SkillStormu musí být možné z názvu/statusu/registru okamžitě poznat, co je dnešní pravda, co schválený budoucí směr a co pouze historie. Dokument, který tuto hranici rozmazává, neprošel D0.**