# Guardian — architektura a bezpečnostní model

Souhrnný dokument guardian vertikály (Etapa D). Dílčí návrhy: `docs/guardian/etapa-a-analyza.md`, `docs/guardian/etapa-b-stop2-navrh.md`, `docs/guardian/etapa-c-stop3-navrh.md`. Tento dokument je bude postupně zastřešovat (architektura, provenance sémantika pro učitele) — začíná RBAC auditem Etapy D.

---

## 1. RBAC průsečíkový audit (21. 7. 2026)

**Metoda:** kanonický zdroj oprávnění je `server/src/modules/rbac/rbac.defaults.ts` (role → default `PermissionKey[]`; RbacGuard vyhodnocuje `@Permission(...)` na endpointech, OWNER má bypass). Pro každou roli a každý jí přiřazený klíč byly dohledány všechny endpointy klíčem gatované (`@Permission(PermissionKey.X)` napříč controllery) a u nich zkontrolována služební vrstva: zda po průchodu RBAC dochází k zúžení dle role/vztahu, nebo zda platí vzor „kdo není STUDENT/TEACHER, dostane školní pohled".

**Kontext:** role PARENT se stala reálně dosažitelnou v Etapě B (párování). Její defaults `[VIEW_RESULTS, VIEW_SUBMISSIONS]` pocházejí z Etapy A — z doby, kdy žádný rodič neexistoval. Dvě díry tohoto typu byly nalezeny a opraveny už v Etapě C (`getStudentResult`, `submissions.findOne`); tento audit systematicky prošel zbytek průsečíku.

### 1.1 Tabulka Role × Permission × Verdikt

Školní role (OWNER/DIRECTOR/TEACHER) drží klíče záměrně — verdikty se soustředí na služební scoping. STUDENT a PARENT jsou rizikové průsečíky.

| Role | Permission | Verdikt | Poznámka |
|---|---|---|---|
| OWNER | `*` (bypass) | ✅ OK | Invariant vlastníka; RbacGuard permission checky přeskakuje, tenant guardy platí. |
| DIRECTOR | TEACHER sada + DIRECTOR_EXTRA | ✅ OK | Org-wide dle záměru; služební vrstvy tenant-scopují (`withOrg`, `assertTenantWhere`). |
| TEACHER | CREATE/EDIT/MANAGE_TESTS, ASSIGN_TESTS | ✅ OK | Class-scope přes `teacherClassScope` (homeroom NEBO úvazek) v results/submissions/classrooms. |
| TEACHER | VIEW_RESULTS / VIEW_SUBMISSIONS | ✅ OK | `tests.results` i `submissions.findAll` zužují na třídy učitele. |
| TEACHER | INVITE_STUDENTS | ✅ OK | Guardian párování (Etapa B) scopováno na vlastní třídy. |
| STUDENT | VIEW_RESULTS | ⚠️ OK s výhradou | Všechny dotčené služby zužují na sebe (`studentId = membership.id`); výhrada: `GET /metrics/summary` — viz N1. |
| STUDENT | VIEW_TEST_OVERVIEW | ✅ OK | Jen číselníky předmětů (`/subjects`), bez citlivého obsahu. |
| STUDENT | VIEW_SUBMISSIONS | ✅ OK | `findAll`/`findOne` vynucují vlastní `studentId`. |
| STUDENT | VIEW_OWN_ASSIGNMENTS | ✅ OK | Own-scoped už názvem i implementací (`/assignments/my`). |
| PARENT | VIEW_RESULTS | ❌ **DÍRY D1–D3, D5** | Viz nálezy níže — služby mají vzor „ne-STUDENT ⇒ školní pohled". |
| PARENT | VIEW_SUBMISSIONS | ❌ **DÍRA D4** | `submissions.findAll` PARENTa nezužuje (a respektuje `?studentId=` filtr). |
| PARENT | VIEW_RESULTS (opravené případy) | ✅ opraveno v Etapě C | `tests.getStudentResult` a `submissions.findOne` → 403 pro PARENT. |
| PARENT | — (guardian API) | ✅ OK | `/guardian/*` nepoužívá PermissionKey — autorizace je vztahová per dítě (VERIFIED + `GuardianPermissionKey`), okamžitá revokace. |

### 1.2 Nálezy (POUZE dokumentace — oprava je samostatný krok)

Aktér u všech: **rodič s dokončeným párováním (aktivní role PARENT)**, bez jakéhokoli vztahu k dotčeným datům.

| # | Závažnost | Endpoint | Problém |
|---|---|---|---|
| **D1** | **KRITICKÁ** | `GET /tests/:id` (`tests.findOne`) | Ne-STUDENT větev vrací **učitelskou projekci s `questions: true` — tedy kompletní klíč správných odpovědí** kteréhokoli testu v organizaci. Rodič si může přečíst řešení testu, který jeho dítě zítra píše. |
| **D2** | vysoká | `GET /tests/:id/results` (`tests.results`) | Zužuje jen STUDENT (na sebe) a TEACHER (na třídy). PARENT propadne bez zúžení → **agregované výsledky celého testu včetně jmen a skóre všech žáků**. |
| **D3** | střední | `GET /tests` (`tests.findAll`) | STUDENT větev filtruje na zadané testy; PARENT propadne do školního listingu → **celý katalog testů organizace** (list projekce bez otázek). |
| **D4** | vysoká | `GET /submissions` (`submissions.findAll`) | TEACHER scope, STUDENT na sebe; PARENT bez zúžení, navíc else-větev **respektuje `?studentId=`** → výpis odevzdání libovolného žáka v org. |
| **D5** | střední | `GET /stats/overview` (`getOrgOverview`) | STUDENT/TEACHER mají zúžený scope; PARENT propadne do org-wide větve → **celoorganizační průměry a počty** (ředitelský pohled). |
| **N1** | nízká | `GET /metrics/summary` | Počítá `FORBIDDEN_ACCESS` audit záznamy **bez org filtru** — kdokoli s VIEW_RESULTS (i STUDENT) vidí platformní číslo. Mimo guardian scope, ale patří do stejného úklidu. |

**Bez nálezu (ověřeno):** `enrollments.listByClassSection` (explicitní fallthrough deny), `class-sections` list/detail/org-subjects (deny pro role < DIRECTOR mimo TEACHER/STUDENT větve), `analytics.studentTimeline` (else → 403), `stats dashboards` student/teacher/director (explicitní role checky), `academic-years` čtení (org metadata — PARENT je potřebuje pro lištu školního roku, obsahově neškodné), `guardian-admin` endpointy (INVITE_STUDENTS + teacher scope).

### 1.3 Kořenová příčina a doporučený směr opravy (rozhodnout před implementací)

Vzor selhání je vždy stejný: služby větví **negativně** („STUDENT dostane své, TEACHER třídy, *zbytek je škola*") a PARENT — role z Etapy A bez konzumentů — zdědil školní fallback. Možnosti opravy:

- **(a) Vyprázdnit PARENT defaults** na klíče, které rodičovský klient skutečně potřebuje (dnes fakticky jen čtení `academic-years` pro lištu roku; rodinný prostor jede přes `/guardian/*`), tj. `PARENT: []` + přesunout academic-years pod vlastní benigní klíč nebo výjimku. Nejmenší plocha, doporučeno.
- **(b) Pozitivní větvení ve službách** (výčet rolí, deny default) — správné dlouhodobě, ale dotýká se mnoha služeb.
- Obojí doplnit regresním e2e: „PARENT × každý dotčený endpoint → 403" (rozšíření matice z Etapy C).

*Oprava se provede v samostatném kroku Etapy D po schválení tohoto auditu.*
