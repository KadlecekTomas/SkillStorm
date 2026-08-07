# SkillStorm Documentation Registry

> **Status:** `CURRENT / NORMATIVE`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** jediný registr autority, životního cyklu a precedence lidské Markdown dokumentace v repozitáři.

---

## 1. Pravidlo autority

Markdown není source of truth jen proto, že existuje. Autoritu určuje:

1. tento registr a status dokumentu;
2. normativní security/privacy/production/data contracts;
3. executable code, migrations, configuration and tests tam, kde dokument popisuje současnou implementaci.

Každý human-authored `.md` zahrnutý do `npm run docs:validate` musí být registrován přes svou **skutečnou cestu**. Starý basename, přibližný název nebo neexistující link není přijatelný.

---

## 2. Statusy

| Status | Význam | Smí řídit nový vývoj? |
| --- | --- | --- |
| `CURRENT / NORMATIVE` | závazný současný kontrakt | ano |
| `CURRENT / NORMATIVE SECURITY CONTRACT` | závazný security/release kontrakt | ano |
| `CURRENT / IMPLEMENTED` | přesný popis současné implementace | ano, pro existující funkcionalitu |
| `CURRENT / IMPLEMENTED — PILOT ONLY` | implementováno, ale není production enterprise capability | pouze v popsaném pilotním rozsahu |
| `CURRENT / RUNBOOK` | současný provozní/vývojový postup | ano, pro danou operaci |
| `VISION / APPROVED` | schválený cílový směr | ano, pro plánovaný vývoj |
| `VISION / PARKED` | odložená hypotéza bez priority | ne, dokud ji Master Roadmap nepovýší |
| `HISTORICAL / ADR` | historický záznam rozhodnutí | ne |
| `HISTORICAL / SNAPSHOT` | audit/plán/devlog minulého stavu | ne |
| `SUPERSEDED` | nahrazen současným dokumentem | ne |

Pokud vlastní hlavička a registr nesouhlasí, jde o dokumentační defect. Pro klasifikaci má do opravy přednost tento registr.

---

## 3. Precedence

Při konfliktu platí:

1. current security/privacy/tenant invarianty v kódu, DB guardech a normativních security contracts;
2. [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md);
3. [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) pro curriculum/versioning/coverage/evidence;
4. [`roadmap/master.md`](./roadmap/master.md) pro pořadí vývoje;
5. current implementation contracts;
6. `VISION / APPROVED` blueprints;
7. parked/historical/superseded dokumenty pouze jako kontext.

`VISION` se nesmí prezentovat jako hotová funkcionalita. Historický dokument nesmí přebít current contract ani kvůli tomu, že obsahuje detailnější starý návrh.

---

## 4. Normativní a schválené produktové dokumenty

| Dokument | Status | Autorita |
| --- | --- | --- |
| [`roadmap/master.md`](./roadmap/master.md) | `CURRENT / NORMATIVE` | jediné závazné pořadí velkých produktových/architektonických kroků |
| [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md) | `CURRENT / NORMATIVE` | production invarianty Activity/Lesson Experience/classroom orchestration |
| [`interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](./interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) | `CURRENT / NORMATIVE` | RVP/ŠVP versioning, mapping, provenance, coverage, evidence |
| [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) | `CURRENT / NORMATIVE SECURITY CONTRACT` | tenant/RBAC negative-test evidence a school-production security gate |
| [`interactive-curriculum/README.md`](./interactive-curriculum/README.md) | `VISION / APPROVED` | Interactive Curriculum product north star |
| [`interactive-curriculum/USE-CASES.md`](./interactive-curriculum/USE-CASES.md) | `VISION / APPROVED` | pedagogický use-case katalog |
| [`interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md`](./interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md) | `VISION / APPROVED` | school curriculum/coverage UX blueprint |
| [`interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md`](./interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md) | `VISION / APPROVED` | Audio & Language Engine blueprint |
| [`interactive-it-lab/README.md`](./interactive-it-lab/README.md) | `VISION / APPROVED` | Interactive IT Lab subject blueprint |
| [`roadmap/partak-2.0.md`](./roadmap/partak-2.0.md) | `VISION / PARKED` | future Parťák hypothesis; bez priority do pilot evidence |

---

## 5. Current implementation contracts

| Dokument | Status |
| --- | --- |
| [`guardian.md`](./guardian.md) | `CURRENT / IMPLEMENTED` |
| [`live-sessions.md`](./live-sessions.md) | `CURRENT / IMPLEMENTED` |
| [`live-sessions-interactions.md`](./live-sessions-interactions.md) | `CURRENT / IMPLEMENTED` |
| [`submissions-concurrency-and-locking.md`](./submissions-concurrency-and-locking.md) | `CURRENT / IMPLEMENTED` |
| [`partak-rules.md`](./partak-rules.md) | `CURRENT / IMPLEMENTED` |
| [`campaigns.md`](./campaigns.md) | `CURRENT / IMPLEMENTED` |
| [`ci.md`](./ci.md) | `CURRENT / IMPLEMENTED` |
| [`google-sso-architecture.md`](./google-sso-architecture.md) | `CURRENT / IMPLEMENTED — PILOT ONLY` |
| [`gdpr-sso-identity.md`](./gdpr-sso-identity.md) | `CURRENT / IMPLEMENTED — PILOT ONLY` |

Current Bleskovky mohou používat `Test`/`Question`; to není precedent pro budoucí komplexní Activity Engine. `PARENT` access zůstává relationship-scoped. Classic `Submission` není automaticky cílový semantic-event evidence model.

---

## 6. Current runbooky a reprodukovatelné asset workflows

| Dokument | Status | Poznámka |
| --- | --- | --- |
| [`ops/backup-restore.md`](./ops/backup-restore.md) | `CURRENT / RUNBOOK` | ověřovat restore drillem |
| [`ops/monitoring.md`](./ops/monitoring.md) | `CURRENT / RUNBOOK` | health/Sentry/logging + deployment alerting |
| [`testing/test-database-isolation.md`](./testing/test-database-isolation.md) | `CURRENT / RUNBOOK` | destructive test DB safety guard |
| [`working-with-claude.md`](./working-with-claude.md) | `CURRENT / RUNBOOK` | tool-neutral AI-assisted engineering workflow |
| [`screenshots/portfolio/index.md`](./screenshots/portfolio/index.md) | `CURRENT / RUNBOOK` | reproducible showcase screenshot set; není product/curriculum authority |

---

## 7. Historical / neautoritativní dokumenty

Tyto soubory se zachovávají kvůli traceability. Nesmějí být použity jako current implementační zadání bez nové revize proti současným contracts.

| Dokument | Status |
| --- | --- |
| [`campaigns-decisions.md`](./campaigns-decisions.md) | `HISTORICAL / ADR` |
| [`roadmap/doctrine.md`](./roadmap/doctrine.md) | `SUPERSEDED` |
| [`roadmap/2026-07-napadnik.md`](./roadmap/2026-07-napadnik.md) | `HISTORICAL / SNAPSHOT` |
| [`production-roadmap.md`](./production-roadmap.md) | `HISTORICAL / SNAPSHOT` |
| [`production-audit.md`](./production-audit.md) | `HISTORICAL / SNAPSHOT` |
| [`production-sso-hardening-audit.md`](./production-sso-hardening-audit.md) | `HISTORICAL / SNAPSHOT` |
| [`ops/production-readiness.md`](./ops/production-readiness.md) | `HISTORICAL / SNAPSHOT` |
| [`ops/query-limits-audit.md`](./ops/query-limits-audit.md) | `HISTORICAL / SNAPSHOT` |
| [`testing/e2e-baseline-audit.md`](./testing/e2e-baseline-audit.md) | `HISTORICAL / SNAPSHOT` |
| [`visual-qa-findings.md`](./visual-qa-findings.md) | `HISTORICAL / SNAPSHOT` |
| [`devlog/2026-06-17-focus-test.md`](./devlog/2026-06-17-focus-test.md) | `HISTORICAL / SNAPSHOT` |
| [`analytics/student-progress-analysis.md`](./analytics/student-progress-analysis.md) | `HISTORICAL / SNAPSHOT` |
| [`analytics/student-progress-phase-2-plan.md`](./analytics/student-progress-phase-2-plan.md) | `HISTORICAL / SNAPSHOT` |
| [`analytics/student-progress-prisma-models.md`](./analytics/student-progress-prisma-models.md) | `HISTORICAL / SNAPSHOT` |
| [`guardian-project.md`](./guardian-project.md) | `HISTORICAL / SNAPSHOT` |
| [`guardian-spec.md`](./guardian-spec.md) | `HISTORICAL / SNAPSHOT` |
| [`guardian/etapa-a-analyza.md`](./guardian/etapa-a-analyza.md) | `HISTORICAL / SNAPSHOT` |
| [`guardian/etapa-b-stop2-navrh.md`](./guardian/etapa-b-stop2-navrh.md) | `HISTORICAL / SNAPSHOT` |
| [`guardian/etapa-c-stop3-navrh.md`](./guardian/etapa-c-stop3-navrh.md) | `HISTORICAL / SNAPSHOT` |
| [`../server/test/e2e-legacy/README.md`](../server/test/e2e-legacy/README.md) | `HISTORICAL / SNAPSHOT` |

Historické soubory mohou obsahovat správné informace o minulém stavu, včetně starých názvů, cest, čísel či návrhů. Tyto údaje se nesmí přenášet do current implementace bez ověření.

---

## 8. Metadata a Definition of Done

Každý aktivní dokument musí viditelně obsahovat:

```text
Status
Last verified/reviewed
Scope / Purpose / Target / Authority (explicitní rozsah/účel)
```

Normativní dokument navíc povinně uvádí `Owner`; u ostatních aktivních dokumentů je owner veden minimálně v registru a doporučen i v souboru.

Dokumentace je připravena jako vstup do vývoje pouze pokud:

```text
[ ] každý human-authored Markdown je registrován přes exact path
[ ] registry neobsahuje neexistující Markdown link
[ ] CURRENT / VISION / HISTORICAL je jednoznačné
[ ] current docs neobsahují legacy product branding, machine-local paths ani demo secrets
[ ] normativní data/security termíny jsou konzistentní
[ ] external normative claims mají authoritative source/provenance
[ ] známé implementation/release gaps nejsou přepsané marketingovým tvrzením
[ ] npm run docs:validate prochází
[ ] Documentation Integrity GitHub Action prochází
```

Passing documentation gate znamená **mechanicky konzistentní a pravdivě klasifikovanou dokumentaci**, nikoli automaticky production-ready celý produkt.

---

## 9. Maintenance policy

- `roadmap/master.md` aktualizovat po každé dokončené fázi/milníku;
- změna current behavior aktualizuje příslušný current contract ve stejném PR;
- nový/přejmenovaný/smazaný `.md` aktualizuje registr a linky ve stejném PR;
- historical snapshot se nikdy potichu nepovýší na current;
- RVP/ŠVP zdroje se ověřují před curriculum release a při změně upstream zdroje;
- runbook se ověřuje praktickým testem/drillem;
- před merge dokumentační změny spustit `npm run docs:validate` a ověřit `Documentation Integrity`.

---

> **Final invariant:** V SkillStormu musí být z registru a lifecycle metadata okamžitě poznat, co je dnešní pravda, co schválený budoucí směr a co pouze historie. Dokument, který tuto hranici rozmazává, neprošel D0.