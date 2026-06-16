# Long-term Student Progress Analytics — analýza a návrh

> **Status:** návrh / RFC. Tento dokument **nic neimplementuje**. Slouží jako technická
> a produktová analýza a podklad pro fázovanou implementaci. Prisma modely, endpointy
> a UI jsou návrhy, které je třeba schválit před realizací.
>
> **Datum:** 2026-06-16
> **Rozsah auditu:** `server/prisma/schema.prisma`, `server/src/analytics/*`,
> `server/src/stats/*`, `server/src/submissions/*`, `server/src/student/*`,
> `server/src/risk/*`, `server/src/metrics/*`.

---

## 0. Shrnutí pro netrpělivé (TL;DR)

SkillStorm už dnes **umí překvapivě hodně**: máme snapshoty na úrovni odpovědi
(`Response.awardedPoints/maxPoints/correctAnswerSnapshot/questionTextSnapshot`),
máme bodové součty na submission (`earnedPoints/maxPoints/score`), máme oddělené
pokusy (`attemptNo`), máme diagnostiku témat (`StudentDiagnosticService`) a
agregaci nejslabších témat.

Zásadní problém pro **dlouhodobý** profil žáka je čtveřice slepých míst:

1. **Identita žáka je vázaná na `Membership`, ne na `User`/`Student`.** `Submission.studentId`
   je ve skutečnosti `membershipId`. Když žák odejde a vrátí se (nové členství), historie se
   rozpadne. Long-term profil přes více let proto potřebuje stabilní kotvu (`Student.id`).
2. **Téma a obtížnost se mapují per-assignment, ne per-question.** Jeden test = jedno
   `topicLevelId` (přes `Assignment.topicLevelId`). Otázka nemá vlastní téma ani obtížnost.
   „Mastery tématu" je dnes reálně „mastery přiřazení".
3. **Žádný neměnný analytický snapshot na úrovni submission** s historicky platným
   `subjectId/topicId/difficulty/classSectionId/testVersion`. Snapshotujeme jen text otázky a
   správnou odpověď. Téma/předmět/třída se čtou živě a mohou se zpětně změnit.
4. **Cross-year analytika je dnes záměrně zablokovaná** (controller vynucuje
   `yearId === activeAcademicYearId`). Dlouhodobý pohled přes ročníky neexistuje.

Doporučení: **Fáze 2 (immutable snapshot po submitu)** je nutná podmínka pro vše ostatní.
Bez ní bude každý „dlouhodobý" graf lhát ve chvíli, kdy učitel upraví test, přemapuje téma
nebo přejde do dalšího školního roku.

---

## 1. Co umíme spolehlivě měřit už dnes

Audit datového modelu a služeb. Pro každou metriku uvádím zdroj a míru spolehlivosti.

### 1.1 Datové podklady, které existují

| Pole | Model | Význam | Spolehlivost |
|---|---|---|---|
| `earnedPoints`, `maxPoints` | `Submission` | bodový zisk / max bodů pokusu | **vysoká** (zapsáno při `finish()`) |
| `score` | `Submission` | normalizované skóre **0–1** (`total/maxScore`) | vysoká, ale pozor na škálu (viz níže) |
| `status` | `Submission` | `PENDING / APPROVED / REJECTED` | vysoká |
| `attemptNo` | `Submission` | pořadí pokusu (per assignment) | vysoká |
| `submittedAt`, `createdAt` | `Submission` | odevzdání / vznik pokusu | vysoká (čas), nízká jako „start" (viz 2) |
| `awardedPoints`, `maxPoints` | `Response` | body za jednotlivou otázku | **vysoká** (snapshot v `finish()`) |
| `isCorrect` | `Response` | správnost odpovědi | vysoká |
| `correctAnswerSnapshot`, `questionTextSnapshot` | `Response` | neměnný text otázky/odpovědi | vysoká |
| `attemptNumber`, `corrected` | `Response` | pokus/oprava per odpověď | střední (málo využité) |
| `Assignment.topicLevelId` | `Assignment` | téma přiřazení | **per-assignment**, ne per-question |
| `Test.subjectId`, `Test.academicYearId` | `Test` | předmět a rok testu | vysoká |
| `Assignment.yearId` | `Assignment` | školní rok zadání | vysoká |
| `Assignment.classSectionId` | `Assignment` | třída zadání | střední (null pro `targetType=STUDENTS`) |

### 1.2 Konkrétní metriky odvoditelné z existujících dat

- **Počet testů / pokusů** — `COUNT(Submission)` (vše), resp. `COUNT(DISTINCT testId)` přes
  best-attempt. Implementováno: `computeStudentPerformance()` (`student-performance.util.ts`),
  `StatsService.getStudentDashboard`.
- **Úspěšnost podle testů** — best attempt per test, váženo body. ✅ existuje.
- **Úspěšnost podle předmětů** — odvoditelné přes `Test.subjectId` nebo
  `topicLevel→subjectLevel→subject`. Částečně v `StudentDiagnosticService` (agreguje subjekty).
- **Úspěšnost podle témat** — `progressByTopic` (`student-performance.util.ts`) a
  `StudentDiagnosticService` (accuracy + status WEAK/WARNING/GOOD). ✅ existuje, ale na
  granularitě **přiřazení**, ne otázky.
- **Vývoj v čase** — `AnalyticsService.studentTimeline` (řazené submissions s percentage).
  ✅ existuje, ale jen pro **aktivní rok**.
- **Průměrné skóre** — vážený průměr `SUM(earnedPoints)/SUM(maxPoints)`. ✅ existuje na více
  místech (dashboardy, performance util). Pozor: `_avg(score)` v `StatsService` míchá škály —
  vážený průměr přes body je správnější a kód to na novějších místech respektuje.
- **Počet opravených odpovědí** — `Response.corrected` existuje, ale je málo plněné →
  dnes **neměřitelné spolehlivě**.
- **Typy chyb** — dnes jen „chybná odpověď na otázku X" (`AnalyticsService.studentErrorOverview`
  agreguje podle `questionId`). Nemáme taxonomii chyb. Existuje `StudentDiagnosticService`
  → `repeatedlyWrongQuestions`.
- **Aktivita v čase** — `submittedAt`/`createdAt` umožní denní/týdenní/měsíční aktivitu.
  Director dashboard počítá „submissions this week". ✅ částečně.
- **Rychlost dokončování** — `submittedAt − createdAt` je **hrubý odhad** (viz 2.1). Per-otázkový
  čas **nemáme**.
- **Progres podle školních let** — `Assignment.yearId` data umožní, ale **kód to dnes blokuje**
  (`AnalyticsController` vynucuje aktivní rok). Datově ano, produktově ne.

### 1.3 Existující analytické komponenty (inventář)

| Komponenta | Soubor | Co dělá | Omezení |
|---|---|---|---|
| `AnalyticsService` | `analytics/analytics.service.ts` | timeline, class heatmap, error/topic overview, trendy 30d vs 30d | jen aktivní rok, trend per-question |
| `StudentDiagnosticService` | `analytics/student-diagnostic.service.ts` | per-topic accuracy, status, weakest topics, repeated mistakes | využívá snapshoty Response ✅ |
| `computeStudentPerformance` | `student/student-performance.util.ts` | best-attempt, vážený průměr, progress by topic | jeden student + jeden rok |
| `StatsService` | `stats/stats.service.ts` | org/student/teacher/director dashboardy, at-risk | hlavně aktuální stav |
| `RiskService` | `risk/risk.service.ts` | risk level (skóre + neaktivita + trend) | trend dnes hardcoded 0 v dashboardu |
| DB views (`@@ignore`) | schema | `vw_student_progress`, `vw_classroom_results`, `vw_teacher_dashboard` | legacy, nevyužité v kódu |

**Závěr sekce:** základní stavební kameny (body, snapshoty odpovědí, témata, pokusy) existují.
Co chybí, je **dlouhodobá osa**, **stabilní identita** a **historická neměnnost** kontextu.

---

## 2. Co neumíme měřit spolehlivě (kritická slepá místa)

### 2.1 Čas a rychlost
- **Nemáme reálný `startedAt`.** `assignments.service.ts:1119` posílá `startedAt = submission.createdAt`,
  ale to je čas vzniku řádku pokusu, ne čas, kdy žák reálně začal řešit (mohl přijít později,
  řešit na více sezení, nechat tab otevřený). `durationSec = submittedAt − createdAt` je proto
  **systematicky nadhodnocený** a nevhodný jako metrika výkonu.
- **Nemáme per-otázkový čas (`responseTimeSec`).** Confidence/rychlost na úrovni otázky nelze
  odvodit. Jediný časový signál na úrovni otázky je `Response.createdAt/updatedAt`, ale ten se
  přepisuje při ukládání průběžných odpovědí.
- Focus Test Mode loguje `FOCUS_EVENT:*` do `AuditLog` s `clientTimestamp` — **použitelné jako
  proxy aktivity/rozptýlení**, ne jako přesný čas.

### 2.2 Měnitelnost testů a otázek po odevzdání
- **Snapshotujeme:** `questionTextSnapshot`, `correctAnswerSnapshot`, `awardedPoints`, `maxPoints`
  na `Response`. To je dobré — když učitel po odevzdání upraví text otázky nebo správnou odpověď,
  historie odpovědi zůstane platná. (E2E test `test-flow-hardening.e2e-spec.ts` case G to ověřuje.)
- **Nesnapshotujeme:** `Test.version` na submission (pole `version` existuje, ale do submission se
  nepropisuje), mapování **téma/předmět/obtížnost**, a třídu žáka. Když učitel:
  - **přemapuje `TopicLevel`** (test/assignment ukáže na jiné téma) → všechny **historické** topic
    statistiky se zpětně přepočítají na nové téma. **Falšuje to dlouhodobý trend.**
  - **změní `Subject` testu** → totéž na úrovni předmětu.
  - **smaže/archivuje test** (`deletedAt`) → `buildCompletedStudentSubmissionWhere` filtruje
    `test.deletedAt: null`, takže odevzdání **zmizí z analytiky**, i když žák test reálně psal.
- Závěr: text otázky je historicky korektní, **ale celý kontext (téma/předmět/obtížnost/verze)
  není.** Pro dlouhodobý profil je to zásadní díra.

### 2.3 Identita a přestupy žáka
- `Submission.studentId` = **`membershipId`** (FK na `Membership`). `Membership` je per-org a může
  být soft-deleted (`deletedAt`). Pokud žák opustí školu a vrátí se → nový `Membership` → nový
  `studentId` → **historie se rozpadne na dvě nesouvisející osoby.**
- **Stabilní kotva je `Student.id`** (1:1 s membership přes `Student.membershipId`), případně
  `User.id`. Pro long-term profil je nutné agregovat přes `Student.id`, ne `membershipId`.
- **Přestup do jiné třídy v rámci roku:** `Assignment.classSectionId` drží třídu v době zadání,
  ale `Enrollment` je source of truth a mění se. U `targetType=STUDENTS` je `classSectionId` null.
  Třída „v době odevzdání" tedy **není jednoznačně dohledatelná** bez snapshotu.
- **Promotion mezi roky** (`PromotionLog`) vytváří nová `Enrollment`/`ClassSection`. Cross-year
  identita žáka přežívá jen přes `Student.id`.

### 2.4 Porovnatelnost a metodika
- **Lehký vs. těžký test nelze férově porovnat.** Difficulty existuje jen jako `TopicLevel.difficulty`
  (`BASIC/INTERMEDIATE/ADVANCED`), **ne na otázce ani na testu**. 80 % na BASIC testu a 80 % na
  ADVANCED testu se dnes počítají stejně. Žádná normalizace obtížnosti.
- **Mastery vs. průměr:** dnes umíme jen **accuracy** (poměr správných). `StudentDiagnosticService`
  přidává prahy (WEAK <50 %, WARNING <75 %, GOOD ≥75 %) a `INSUFFICIENT_DATA` při <3 odpovědích —
  to je rozumný základ, ale není to skutečné mastery (nezohledňuje recency, obtížnost, stabilitu).
- **Oddělení pokusů:** `attemptNo` (submission) a `attemptNumber` (response) existují. Best-attempt
  logika je implementovaná. ✅ — toto je v pořádku.
- **Dost dat pro porovnání ročníků?** Datově ano (`yearId`), ale bez snapshotu a bez stabilní
  identity je cross-year srovnání nespolehlivé.

### 2.5 Tabulka rizik blind-spotů

| Blind spot | Dopad na dlouhodobý profil | Závažnost |
|---|---|---|
| Identita = membership, ne student | Historie se tříští po re-enrollmentu | 🔴 kritická |
| Téma/předmět/obtížnost se čtou živě | Zpětné falšování trendů po editaci | 🔴 kritická |
| Žádný submission-level snapshot | Není „historicky platná pravda" | 🔴 kritická |
| Soft-deleted test mizí z analytiky | Chybějící historie | 🟠 vysoká |
| `startedAt`/duration nespolehlivé | Rychlost = nepoužitelná metrika | 🟠 vysoká |
| Difficulty jen na topic, ne otázce | Nelze normalizovat obtížnost | 🟠 vysoká |
| Cross-year blokováno v controlleru | Dlouhodobý pohled nedostupný | 🟡 střední (snadná oprava) |
| `corrected` málo plněné | „Oprava chyby" neměřitelná | 🟡 střední |

---

## 3. Návrh produktových metrik

Metriky musí mít **vysvětlitelnou definici** (obhajitelnou ve škole i v bakalářské práci).
U každé skupiny rozlišuji, co jde **dnes** vs. co potřebuje snapshot.

### A) Žák
| Metrika | Definice | Dostupnost |
|---|---|---|
| Dlouhodobá úspěšnost | vážený `SUM(earnedPoints)/SUM(maxPoints)` přes celé období | po snapshotu (cross-year) |
| Trend zlepšení/zhoršení | sklon lineární regrese percentage v čase (např. po měsících) | po snapshotu |
| Nejsilnější témata | top-N topic mastery (viz §8) | částečně dnes (per rok) |
| Nejslabší témata | bottom-N topic mastery s `totalAnswers ≥ práh` | ✅ dnes (`weakestTopics`) |
| Opakované chyby | otázky/koncepty s ≥2 chybnými odpověďmi | ✅ dnes (`repeatedlyWrongQuestions`) |
| Doporučené oblasti | slabá témata × dostupné materiály (`MaterialAssignment`) | nové (Fáze 6) |
| Konzistence práce | směrodatná odchylka percentage / pravidelnost aktivity | po snapshotu |
| Splněné testy/procvičování | `COUNT(DISTINCT testId)` best-attempt | ✅ dnes |
| Progres za rok/pololetí/měsíc | metriky bucketované podle období | po snapshotu (month bucket) |

### B) Učitel
| Metrika | Definice | Dostupnost |
|---|---|---|
| Profil žáka | agregace A) pro jednoho žáka | částečně dnes |
| Rizikové oblasti | témata třídy s mastery pod prahem | ✅ dnes (teacher topic overview) |
| Porovnání žáka se třídou | žák percentage vs. medián/průměr třídy (per téma) | po snapshotu |
| Vývoj po tématech/předmětech | časové řady mastery | po snapshotu |
| Kdo stagnuje | trend ≈ 0 a mastery < práh po N týdnů | po snapshotu |
| Kdo se zlepšuje | trend > práh | po snapshotu |
| Vysoká aktivita / nízká úspěšnost | `submissions ↑` ∧ `mastery ↓` (kvadrant) | po snapshotu |
| Nízká aktivita | `daysSinceLastActivity` nad práh | ✅ dnes (risk model) |
| Problémová témata třídy | témata s nízkým průměrem a vysokým rozptylem | ✅ dnes částečně |

### C) Rodič (srozumitelně, bez žargonu)
- **Jak si dítě vede** — jedno číslo 0–100 + slovní popis („daří se", „potřebuje podporu").
- **Vývoj v čase** — jednoduchý sloupcový/čárový graf po měsících (jen barva trendu).
- **Kde potřebuje pomoct** — 2–3 nejslabší témata lidským jazykem.
- **Co se zlepšilo** — 1–2 pozitivní změny (povinně, kvůli motivaci).
- **Co procvičit** — konkrétní doporučení (materiál/téma).
- **Žádné** percentily, žádné srovnání se jmény spolužáků.

### D) Vedení školy (agregace, ne šmírování)
- Trendy napříč třídami/ročníky (průměrné mastery, ne jména).
- Problematická témata napříč školou (rank tématu podle průměru/rozptylu).
- Úspěšnost předmětů (per subject).
- Využití platformy (aktivní žáci/učitelé, submissions/týden) — částečně dnes v director dashboardu.
- Dopad používání (korelace aktivity vs. zlepšení) — opatrně, **ne jako kauzalita**.
- **Práh anonymizace:** agregáty s < k žáky (např. k=5) se nezobrazí (viz §9).

---

## 4. Datová architektura

### 4.1 Rozhodnutí: live query vs. analytická vrstva

| Pohled | Doporučení |
|---|---|
| Detail jednoho žáka, aktuální rok | **live query** stačí (objem malý) |
| Dlouhodobý profil přes roky | **materializovaný snapshot** — jinak nesprávné (editace + identita) |
| Třídní/školní agregace | **materializované rollupy** + cache (dnes versioned cache 60 s) |
| Recommendations/mastery | počítat **on-demand z snapshotů** (vstup je už neměnný) |

**Závěr:** seriózní návrh = raw data zůstávají v `Submission`/`Response` (source of truth pro
známkování a re-scoring), a po `finish()` se vytvoří **neměnný analytický snapshot** se
zafixovaným kontextem. Agregace se počítají **ze snapshotů**, ne z živých joinů na `Test`/`TopicLevel`.

### 4.2 Navrhované Prisma modely (NEIMPLEMENTOVAT bez schválení)

#### `SubmissionFact` — fakta o jednom odevzdaném pokusu
```prisma
model SubmissionFact {
  id                String   @id @default(uuid()) @map("submission_fact_id")
  submissionId     String   @unique @map("submission_id")

  // Stabilní identita (kotva pro long-term — NE membershipId)
  studentId        String   @map("student_id")        // Student.id
  membershipId     String   @map("membership_id")     // pro audit/aktuální vazbu
  organizationId   String   @map("organization_id")

  // Historicky platný kontext (zafixovaný v čase odevzdání)
  academicYearId   String?  @map("academic_year_id")
  classSectionId   String?  @map("class_section_id")  // třída v době odevzdání
  subjectId        String?  @map("subject_id")
  catalogSubjectId String?  @map("catalog_subject_id")
  topicLevelId     String?  @map("topic_level_id")
  catalogTopicId   String?  @map("catalog_topic_id")
  testId           String   @map("test_id")
  testVersion      Int      @map("test_version")

  // Výsledek
  score            Int      @map("earned_points")     // = earnedPoints
  maxScore         Int      @map("max_points")
  percentage       Float                                // score/maxScore*100, denormalizováno
  questionCount    Int      @map("question_count")
  correctCount     Int      @map("correct_count")
  incorrectCount   Int      @map("incorrect_count")

  // Rozpady (denormalizované JSON pro rychlé čtení)
  difficultyBreakdown Json? @map("difficulty_breakdown") // {BASIC:{n,correct},...}
  questionTypeBreakdown Json? @map("question_type_breakdown")

  // Čas
  startedAt        DateTime? @map("started_at")        // viz §2.1 — zatím = createdAt
  submittedAt      DateTime  @map("submitted_at")
  durationSec      Int?      @map("duration_sec")
  attemptNo        Int       @map("attempt_no")
  isBestAttempt    Boolean   @default(false) @map("is_best_attempt")

  createdAt        DateTime  @default(now()) @map("created_at")

  @@index([studentId, submittedAt])
  @@index([studentId, subjectId, submittedAt])
  @@index([studentId, academicYearId])
  @@index([organizationId, academicYearId, subjectId])
  @@index([classSectionId, submittedAt])
  @@index([topicLevelId])
  @@map("submission_facts")
}
```
- **Proč:** jeden neměnný řádek = jeden odevzdaný pokus s historicky platným kontextem.
  Bez něj nelze dělat pravdivý dlouhodobý/cross-year pohled.
- **Jak se plní:** transakčně v `SubmissionsService.finish()`, hned po zápisu submission/response
  (ve stejné `$transaction`), nebo přes domain event `SubmissionFinishedEvent` (fire-and-forget
  s retry). Doporučení: **uvnitř transakce** (konzistence > výkon; objem je malý).
- **Kdy se aktualizuje:** **nikdy** (immutable). Výjimky: (a) `deletedAt`/anonymizace žáka →
  tombstone/redakce, ne smazání faktu pro agregáty; (b) přepočet `isBestAttempt` v rámci téhož
  (student, test) při novém pokusu — to je jediná povolená mutace, a jen tohoto flagu.
- **Immutable:** ano (kromě `isBestAttempt`).
- **Indexy:** viz výše — pokrývají student-timeline, per-subject, per-year, class rollup, topic.

#### `ResponseFact` — per-question fakta
```prisma
model ResponseFact {
  id                String   @id @default(uuid()) @map("response_fact_id")
  submissionFactId String   @map("submission_fact_id")
  responseId       String   @unique @map("response_id")

  studentId        String   @map("student_id")
  organizationId   String   @map("organization_id")
  academicYearId   String?  @map("academic_year_id")

  questionId       String   @map("question_id")
  questionType     QuestionType @map("question_type")
  topicLevelId     String?  @map("topic_level_id")    // snapshot mapování
  catalogTopicId   String?  @map("catalog_topic_id")
  subjectId        String?  @map("subject_id")
  difficulty       Difficulty? // snapshot obtížnosti (z TopicLevel, dokud není na otázce)

  score            Int      @map("awarded_points")
  maxScore         Int      @map("max_points")
  isCorrect        Boolean
  attemptNumber    Int      @default(1) @map("attempt_number")
  corrected        Boolean  @default(false)
  responseTimeSec  Int?     @map("response_time_sec") // null dokud nesbíráme (§2.1)

  submittedAt      DateTime @map("submitted_at")
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([studentId, topicLevelId, submittedAt])
  @@index([studentId, subjectId, submittedAt])
  @@index([topicLevelId, isCorrect])
  @@index([submissionFactId])
  @@map("response_facts")
}
```
- **Proč:** mastery a analýza chyb potřebují per-otázkovou granularitu s neměnným tématem/obtížností.
- **Jak se plní:** současně se `SubmissionFact`, z už osnapshotovaných `Response` (které mají
  `awardedPoints/maxPoints/isCorrect`).
- **Immutable:** ano.
- **Indexy:** student×téma×čas (mastery time-series), téma×správnost (class topic stats).

#### `StudentTopicMastery` — materializované mastery (rollup)
```prisma
model StudentTopicMastery {
  id              String   @id @default(uuid())
  studentId       String   @map("student_id")
  organizationId  String   @map("organization_id")
  topicLevelId    String   @map("topic_level_id")
  catalogTopicId  String?  @map("catalog_topic_id")
  subjectId       String?  @map("subject_id")
  academicYearId  String?  @map("academic_year_id") // null = all-time

  masteryScore    Float    @map("mastery_score")    // 0–100 (viz §8)
  accuracy        Float                              // 0–1 raw
  answeredCount   Int      @map("answered_count")
  confidenceLevel String   @map("confidence_level")  // LOW/MEDIUM/HIGH dle vzorku
  lastAnsweredAt  DateTime? @map("last_answered_at")
  trend           String?                            // BETTER/SAME/WORSE
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([studentId, topicLevelId, academicYearId])
  @@index([organizationId, topicLevelId])
  @@index([studentId, masteryScore])
  @@map("student_topic_mastery")
}
```
- **Proč:** mastery je dražší výpočet (recency, váhy); materializace = rychlé dashboardy.
- **Jak se plní:** přepočet po `finish()` jen pro dotčená témata daného žáka (incremental),
  plus noční batch pro recency decay (mastery klesá časem i bez nové aktivity).
- **Kdy se aktualizuje:** po každém submitu (dotčená témata) + noční job (decay/trend).
- **Immutable:** ne — je to derivovaný cache. Lze kdykoli přepočítat ze `ResponseFact`.
- **Indexy:** unique (student,téma,rok); org×téma pro class rollup.

### 4.3 Co počítat kde

| Vrstva | Obsah | Strategie |
|---|---|---|
| Source of truth | `Submission`, `Response` | beze změny, re-scoring možný |
| Immutable facts | `SubmissionFact`, `ResponseFact` | zápis po `finish()`, nikdy nemutovat |
| Materialized rollups | `StudentTopicMastery` (+ příp. summary tabulky §5) | incremental po submitu + noční batch |
| On-demand | timeline, porovnání se třídou, recommendations | live query nad facts/rollupy + cache |

---

## 5. Úrovně agregace

| Úroveň | Zdroj | Strategie | Důvod |
|---|---|---|---|
| Student overall summary | `SubmissionFact` (all-time) | on-demand + cache 5 min | malý objem, ale cross-year |
| Student per subject | `SubmissionFact` group by subjectId | on-demand + cache | rychlé z indexu |
| Student per topic | `StudentTopicMastery` | **materializované** | drahý výpočet (mastery) |
| Student per academic year | `SubmissionFact` group by yearId | on-demand | jednoduchá agregace |
| Student per month | `SubmissionFact` bucket by month | on-demand (případně materializovat při velkém objemu) | trend/timeline |
| Class summary | `SubmissionFact`/`ResponseFact` group by classSectionId | **materializované** + versioned cache | čte se často (učitel) |
| Organization summary | rollup tříd | **materializované** noční batch | drahé, nepotřebuje real-time |

**Pravidlo přepočtu:**
- **Po submitu (synchronně/eventem):** `SubmissionFact`, `ResponseFact`, dotčené
  `StudentTopicMastery` daného žáka, invalidace versioned cache třídy.
- **Noční batch:** recency decay mastery, trendy, org/class summary, „stagnace/zlepšení" flagy.
- **On-demand:** vše ostatní z indexovaných facts.

Pozn.: dnes už existuje versioned-cache infrastruktura (`org-cache.utils`, `bumpOrgVersion`,
`cacheGetOrSet`) — znovupoužít pro analytics rollupy.

---

## 6. Návrh API

Konvence: prefix `/analytics`, JWT + `OrgContext`, tenant scope přes `organizationId` z kontextu
(stejný vzor jako stávající controller). **Pozn.:** stávající controller vynucuje aktivní rok —
nové long-term endpointy musí tuto restrikci **uvolnit** a místo toho validovat, že `yearId`
(pokud zadaný) patří do `organizationId`.

Společné principy ochrany:
- **Tenant scope:** vždy `organizationId` z `OrgContext`, nikdy z query. `studentId` se ověřuje
  proti org (jako dnes v `studentTimeline`/`StudentDiagnosticService`).
- **Osobní data:** rodič/ředitel dostávají redukované payloady (viz §9). Agregáty pod práh k=5
  se nevrací.
- **Role gating:** `@Permission(...)` + explicitní kontrola role v service.

| Endpoint | Kdo | Payload (zkráceně) | Filtry | Ochrana |
|---|---|---|---|---|
| `GET /analytics/students/:studentId/overview` | STUDENT(self), TEACHER, DIRECTOR, PARENT(child) | overall %, trend, počet testů, top/bottom témata, last activity | `?yearId`, `?from&to` | org scope + self/relace; parent → child mapping |
| `GET /analytics/students/:studentId/timeline` | jako výše | pole bodů v čase (submissionFacts) | `?yearId`, `?subjectId`, `?bucket=month` | org scope |
| `GET /analytics/students/:studentId/subjects` | jako výše | per-subject % + trend | `?yearId` | org scope |
| `GET /analytics/students/:studentId/topics` | STUDENT(self), TEACHER, DIRECTOR | per-topic mastery, accuracy, confidence, weakest | `?yearId`, `?subjectId` | org scope; parent → jen zjednodušená verze |
| `GET /analytics/students/:studentId/recommendations` | STUDENT(self), TEACHER, PARENT(child) | doporučená témata + materiály | `?subjectId` | org scope |
| `GET /analytics/classes/:classSectionId/progress` | TEACHER(of class), DIRECTOR | class summary, per-topic, rozptyl, kvadranty | `?yearId`, `?subjectId` | class ownership/homeroom check |
| `GET /analytics/classes/:classSectionId/students` | TEACHER(of class), DIRECTOR | seznam žáků + risk + trend (jména) | `?yearId` | class ownership |
| `GET /analytics/organization/overview` | DIRECTOR, OWNER | agregace tříd/ročníků/předmětů, využití, **bez jmen** pod k=5 | `?yearId` | role gate + k-anonymita |
| `GET /analytics/students/:studentId/export` | STUDENT(self), DIRECTOR, PARENT(child) | PDF/CSV progresu | `?yearId`, `?format` | `ExportLog` audit (povinně) |

Příklad payloadu `…/overview`:
```jsonc
{
  "studentId": "…",
  "scope": { "from": "2024-09-01", "to": "2026-06-16", "yearIds": ["…","…"] },
  "overall": { "percentage": 73.4, "completedTests": 41, "trend": "BETTER" },
  "strongestTopics": [ { "topicId":"…","name":"Zlomky","mastery": 88 } ],
  "weakestTopics":  [ { "topicId":"…","name":"Slovní úlohy","mastery": 41, "confidence":"HIGH" } ],
  "lastActivityAt": "2026-06-10T08:21:00Z",
  "dataQuality": { "snapshotCoverage": 1.0, "preSnapshotEstimated": false }
}
```
> `dataQuality` je **důležité** — odlišuje data počítaná z neměnných snapshotů od dat
> odhadnutých z živých joinů (před zavedením Fáze 2). UI to musí umět zobrazit jako disclaimer.

---

## 7. Informační architektura UI/UX (ne hotový dashboard)

### A) Student detail — dlouhodobý profil
- **Hero:** jedno hlavní skóre (0–100) + trend (šipka/barva) + období přepínač (vše / rok / měsíc).
- **Předměty:** karty s % a mini-trendem.
- **Témata:** dvě kolony — *Silné stránky* / *Na čem zapracovat* (mastery + confidence badge).
- **Timeline:** čárový graf percentage v čase (per submission / per month).
- **Poslední aktivita:** seznam posledních pokusů (z `recentTests`, display-only).
- **Doporučení:** 2–3 témata + odkaz na materiál.
- **Disclaimer:** „Hodnoty ukazují průměrnou úspěšnost, ne celkové schopnosti žáka."

### B) Teacher view
- **Detail žáka** (= A, plné mastery + confidence).
- **Porovnání ve třídě:** žák vs. medián třídy per téma (žádné žebříčky veřejně).
- **Filtry:** školní rok / předmět / téma.
- **Varování:** badge „stagnace", „vysoká aktivita / nízká úspěšnost", „neaktivní".
- **Class heatmap:** témata × skupiny žáků (rozšířit stávající `class-heatmap`).

### C) Parent view
- **Jednoduchá verze A** — 1 hlavní číslo + slovní hodnocení, měsíční trend (jen barvy).
- 2–3 nejslabší + 1–2 zlepšení, lidským jazykem.
- 1 jasné doporučení („procvičte zlomky — zde materiál").
- **Žádné** technické grafy, percentily, srovnání se spolužáky.

### D) Director view
- Agregace tříd/ročníků/předmětů (trendy, ne jednotliví žáci).
- Top problémová témata školy.
- Využití platformy (aktivní žáci/učitelé, submissions/týden).
- **Drill-down jen po třídu/téma**, ne na konkrétního žáka bez explicitního oprávnění a auditu.
- k-anonymita: skupiny < 5 žáků skryté.

---

## 8. Metoda výpočtu „mastery" (MVP, vysvětlitelný algoritmus)

Cíl: jedno číslo **0–100 per téma**, lepší než holé procento, **bez AI**, plně obhajitelné.

### 8.1 Vstupy (z `ResponseFact`)
Pro dané (žák, téma) vezmi všechny odpovědi `r_i` s atributy:
`isCorrect_i`, `difficulty_i ∈ {BASIC,INTERMEDIATE,ADVANCED}`, `submittedAt_i`.

### 8.2 Váhy
- **Obtížnost:** `w_diff = {BASIC: 1.0, INTERMEDIATE: 1.3, ADVANCED: 1.6}`.
  Správná těžká odpověď váží víc; chybná těžká trestá méně (níže).
- **Recency:** exponenciální decay `w_rec = 0.5 ^ (ageDays / H)`, half-life `H = 90` dní.
  Novější výkon má větší váhu → mastery „dýchá" v čase.
- **Celková váha odpovědi:** `w_i = w_diff_i × w_rec_i`.

### 8.3 Vážená accuracy
```
weightedCorrect = Σ (w_i × isCorrect_i)
weightedTotal   = Σ  w_i
baseAccuracy    = weightedCorrect / weightedTotal        // 0–1
```

### 8.4 Penalizace opakovaných chyb a bonus za stabilitu
- **Penalizace:** pro otázku/koncept zodpovězený opakovaně chybně (`corrected=false` a ≥2 chyby)
  odečti `penalty = min(0.15, 0.05 × repeatedWrongConcepts)`.
- **Bonus za stabilitu:** pokud poslední `k=5` odpovědí je správně a rozptyl nízký,
  přičti `bonus = min(0.05, 0.01 × streak)`.
```
masteryRaw = clamp(baseAccuracy − penalty + bonus, 0, 1)
masteryScore = round(masteryRaw × 100)
```

### 8.5 Oddělení accuracy vs. confidence
- **Accuracy** = `masteryScore` (jak dobře).
- **Confidence** = jak moc dané hodnotě věřit, podle **velikosti a rozprostření vzorku**:
  - `LOW`  : `answeredCount < 3` → ve UI „málo dat".
  - `MEDIUM`: `3 ≤ answeredCount < 8`.
  - `HIGH` : `answeredCount ≥ 8` a aspoň 2 různé testy/dny.
- UI **nikdy** neukazuje masteryScore bez confidence badge. `LOW` confidence = neukazovat
  v žebříčcích/varováních (chrání proti falešným závěrům z 1–2 odpovědí).

### 8.6 Vlastnosti (proč je to obhajitelné)
- Deterministické, auditovatelné, každé číslo lze rozložit na vstupy.
- Parametry (`H`, váhy, prahy) jsou explicitní konstanty → laditelné a dokumentovatelné.
- Bez black-boxu → vhodné pro bakalářskou práci i pro vysvětlení škole.
- **Limit:** difficulty je dnes jen na úrovni tématu (ne otázky) → `w_diff` je per-téma konstanta,
  dokud nepřibude obtížnost na `Question`. To je férové uvést jako známé omezení.

---

## 9. GDPR / bezpečnost

### 9.1 Kdo smí vidět detail žáka
| Role | Rozsah |
|---|---|
| STUDENT | **jen vlastní** data (jako dnes — `membershipId` self-check) |
| TEACHER | žáci ve **vlastních třídách** (homeroom / created assignments / class ownership) |
| DIRECTOR / OWNER | žáci ve **vlastní organizaci**, ale detail po žáka **s auditem** |
| PARENT | **jen vlastní dítě** — vyžaduje **chybějící** model vazby rodič↔žák (viz níže) |
| SUPERADMIN | platform scope, ale na detail žáka **nikoli rutinně** (jen support s auditem) |

> ⚠️ **Chybí parent↔student vazba.** Role `PARENT` v enumu existuje, ale model spojení rodiče
> s konkrétním žákem ne. Parent view nelze bezpečně postavit, dokud nepřibude
> (např. `GuardianLink { guardianMembershipId, studentId, relation, verifiedAt }`). Toto je
> blokátor sekce C a je třeba ho navrhnout zvlášť.

### 9.2 Co vidí rodič / vedení
- **Rodič:** jen agregát svého dítěte, žádná data jiných žáků, žádné srovnání se jmény.
- **Vedení:** agregáty; detail žáka jen s oprávněním a auditem; **k-anonymita** (skupiny < 5 skryté),
  aby z „třídy se 3 žáky" nešlo odvodit jednotlivce.

### 9.3 Anonymizace, export, audit, retention
- **Anonymizace:** `User.anonymized/anonymizedAt` už existuje. `SubmissionFact` drží `studentId`
  → při anonymizaci **redigovat osobní identifikátory**, ale **ponechat agregovatelná fakta**
  (skóre, téma) pro školní statistiky — nebo přepnout na anonymní pseudo-ID. Rozhodnutí
  retention vs. právo na výmaz je nutné explicitně doladit s DPO.
- **Export:** každý export přes `ExportLog` (model existuje) — povinně zapsat `type/format/exportedById`.
  Existuje i `privacy` modul — propojit.
- **Audit přístupů:** čtení detailu žáka učitelem/ředitelem logovat do `AuditLog`
  (`action: ANALYTICS_STUDENT_DETAIL_READ`, `entityType: STUDENT`). Dnes `StatsService` audituje
  org overview — stejný vzor rozšířit na detail žáka.
- **Retention:** definovat dobu držení `SubmissionFact`/`ResponseFact` po odchodu žáka
  (`EnrollmentStatus.LEFT/GRADUATED`). Návrh: agregáty držet pro školní reporting, raw odpovědi
  (`givenText`) podléhají kratší retenci.
- **Soft-delete:** `Student.deletedAt`, `Membership.deletedAt`, `Submission.deletedAt` existují.
  Facts musí respektovat soft-delete (vyloučit z osobního detailu, volitelně ponechat v anonymních
  agregátech).
- **Po odchodu žáka:** historie přežívá přes `Student.id`; přístup k detailu se odebere
  (membership soft-deleted), ale data zůstávají pro reporting dle retenční politiky.

---

## 10. Rizika a trade-offy

| Téma | Hodnocení |
|---|---|
| **MVP** | Fáze 1–3: raw metriky → snapshot → student detail (aktuální + jeden rok). Realistické, vysoká hodnota. |
| **Až enterprise** | Org-wide rollupy, prediktivní stagnace, cross-school benchmarky, datový warehouse. |
| **Metodicky nebezpečné** | Prezentovat percenta jako „schopnosti". Porovnávat lehký a těžký test 1:1. Mastery z 1–2 odpovědí. Duration jako výkon. |
| **Falešné/zavádějící** | Trend z malého vzorku; topic mastery při přemapovaném tématu (bez snapshotu); „zlepšení", které je jen lehčí test. |
| **Nesmí se prezentovat jako objektivní pravda** | Mastery score, risk level, „stagnace" — vždy s confidence a disclaimerem. |
| **Riziko špatné interpretace** | Rodič: nízké číslo → panika; učitel: „vysoká aktivita/nízká úspěšnost" → trest místo podpory. Mitigace: slovní rámování, confidence badge, k-anonymita. |

**Zlaté pravidlo:** každé skóre ukazovat s (a) velikostí vzorku/confidence, (b) slovním
rámcem, (c) informací, zda jde o snapshot nebo odhad.

---

## 11. Fázování implementace

### Fáze 1 — Audit + raw metriky z existujících dat
- **Rozsah:** uvolnit cross-year v `/analytics` (validovat `yearId ∈ org` místo `=== active`);
  long-term overview/timeline **z živých dat** s explicitním `dataQuality.preSnapshotEstimated=true`.
- **Riziko:** nízké (čtení). Data mohou být zpětně zkreslená editacemi → proto disclaimer.
- **Hodnota:** rychlý dlouhodobý pohled bez DB migrace.
- **Testy:** unit nad agregacemi, tenant-scope e2e (cizí org/žák → 403/404).
- **Neimplementovat:** mastery, recommendations, parent view.

### Fáze 2 — Immutable analytics snapshot po submitu ⭐ (nutná podmínka)
- **Rozsah:** `SubmissionFact` + `ResponseFact`, zápis v `finish()` transakci; backfill job pro
  historická data (s příznakem `estimated`); přepnout analytiku na čtení z facts.
- **Riziko:** střední — migrace + transakční zápis + backfill korektnosti.
- **Hodnota:** **nejvyšší** — bez ní je dlouhodobá analytika nespolehlivá.
- **Testy:** snapshot immutability (editace testu po submitu nezmění fact), backfill parity,
  best-attempt přepočet, transakční atomicita.
- **Neimplementovat:** mastery rollupy (až Fáze 6), per-question timing.

### Fáze 3 — Student detail dashboard
- **Rozsah:** UI §7A nad facts; overview/timeline/subjects/topics endpointy.
- **Riziko:** nízké–střední (FE).
- **Hodnota:** vysoká — hlavní „face" produktu pro žáka.
- **Testy:** FE komponenty, kontrakt endpointů, prázdné/málo dat (confidence LOW).
- **Neimplementovat:** porovnání se třídou (Fáze 4).

### Fáze 4 — Teacher class analytics
- **Rozsah:** class progress, porovnání žák↔třída, kvadranty, varování stagnace/aktivita;
  materializované class rollupy + versioned cache.
- **Riziko:** střední (correctness agregací, ownership checks).
- **Hodnota:** vysoká pro učitele (retence produktu).
- **Testy:** ownership/homeroom e2e, rollup parity, k-anonymita.
- **Neimplementovat:** org-wide, prediktivní modely.

### Fáze 5 — Parent / Director views
- **Rozsah:** parent↔student vazba (`GuardianLink`) + zjednodušený parent view; director agregace
  s k-anonymitou.
- **Riziko:** **vyšší** — GDPR, nová vazba, riziko misinterpretace.
- **Hodnota:** vysoká produktová (rodiče), ale citlivá.
- **Testy:** parent vidí jen své dítě (e2e), k-anonymita, audit přístupů.
- **Neimplementovat:** rodič nesmí vidět srovnání se spolužáky.

### Fáze 6 — Recommendations / mastery model
- **Rozsah:** `StudentTopicMastery` rollup + algoritmus §8; doporučení (slabé téma × materiál);
  noční batch (decay, trend).
- **Riziko:** střední–vyšší (metodika, obhajitelnost).
- **Hodnota:** diferenciátor produktu + jádro bakalářské práce.
- **Testy:** deterministické unit testy mastery (fixní vstup→výstup), recency decay, confidence prahy.
- **Neimplementovat:** AI/ML; obtížnost na otázce (samostatný návrh).

### Fáze 7 — Exports / reporting
- **Rozsah:** PDF/CSV progresu žáka/třídy; `ExportLog` audit; retenční politika.
- **Riziko:** střední (GDPR, formátování).
- **Hodnota:** střední–vysoká (rodiče, vedení, doklady).
- **Testy:** export audit zapsán, obsah respektuje role/anonymizaci.
- **Neimplementovat:** hromadné exporty bez auditu/rate-limitu.

---

## 12. Závěrečné shrnutí

### Co už projekt podporuje ✅
- Bodové výsledky a normalizované skóre na submission (`earnedPoints/maxPoints/score`).
- **Snapshoty na úrovni odpovědi** (text otázky, správná odpověď, body) — historicky korektní.
- Oddělené pokusy (`attemptNo`/`attemptNumber`) a best-attempt logika.
- Per-topic diagnostika (accuracy, status WEAK/WARNING/GOOD, weakest topics, repeated mistakes).
- Student/teacher/director/org dashboardy a risk model (skóre + neaktivita).
- Timeline a class heatmap (ale jen aktivní rok), error/topic 30d trendy.
- Versioned-cache infrastruktura znovupoužitelná pro analytics.
- Audit (`AuditLog`) a export log (`ExportLog`) modely.

### Co musí přibýt do DB
- `SubmissionFact` + `ResponseFact` (immutable snapshot s historickým kontextem).
- `StudentTopicMastery` (materializované mastery rollupy).
- `GuardianLink` (vazba rodič↔žák) — blokátor parent view.
- (Doporučeno, ne nutné pro MVP) obtížnost na `Question` a reálný `startedAt`/per-question timing.
- Případně summary tabulky pro class/org rollupy (jinak versioned cache).

### Co musí přibýt do backendu
- Zápis facts v `SubmissionsService.finish()` (transakčně) + backfill job.
- Long-term/cross-year analytics service nad facts (uvolnit `yearId === active` restrikci).
- Mastery výpočet (§8) + incremental přepočet + noční batch (decay/trend/rollup).
- Nové `/analytics/...` endpointy (§6) s tenant scope, role gating, k-anonymitou.
- Audit čtení detailu žáka; export přes `ExportLog`; retenční joby.

### Co musí přibýt do frontendu
- Student dlouhodobý profil (§7A), teacher class view (§7B), parent (§7C), director (§7D).
- Komponenty pro trend, mastery + confidence badge, timeline, kvadranty.
- Disclaimery / `dataQuality` indikátory (snapshot vs. odhad, malý vzorek).

### Největší produktové příležitosti 🚀
- **Dlouhodobý vzdělávací profil žáka přes ročníky** — reálný diferenciátor proti „jen průměru".
- **Mastery + doporučení** — actionable hodnota pro žáka/rodiče, jádro bakalářské práce.
- **Teacher early-warning** (stagnace, vysoká aktivita/nízká úspěšnost) — retence učitelů.
- **Srozumitelný parent report** — důvod, proč škola platformu zavede.

### Největší technické dluhy / rizika ⚠️
1. **Identita vázaná na `membershipId`, ne `Student.id`** → tříštění historie. (kritické)
2. **Žádný submission-level snapshot kontextu** (téma/předmět/obtížnost/verze/třída) →
   zpětné falšování trendů po editaci. (kritické)
3. **Cross-year zablokováno v controlleru** → dlouhodobý pohled dnes nedostupný. (snadná oprava)
4. **Soft-deleted testy mizí z analytiky** → chybějící historie.
5. **Duration/rychlost nespolehlivá** (`startedAt = createdAt`), per-question timing chybí.
6. **Obtížnost jen na tématu, ne otázce** → nelze férově normalizovat obtížnost.
7. **Chybí parent↔student vazba** → parent view nelze bezpečně postavit.
8. **Metodické riziko interpretace** → bez confidence/rámování hrozí falešné závěry.
```
