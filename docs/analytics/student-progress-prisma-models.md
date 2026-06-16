# Fáze 2 — Prisma modely `SubmissionFact` / `ResponseFact` (návrh)

> **Status:** dokumentační návrh / RFC. **Nic se neimplementuje** — žádný kód, žádná migrace, žádný commit.
> Navazuje na [student-progress-phase-2-plan.md](student-progress-phase-2-plan.md) (bod 1 checklistu §9)
> a [student-progress-analysis.md](student-progress-analysis.md).
>
> **Datum:** 2026-06-16
> **Vstupní rozhodnutí (zafixovaná):** Q1 `userId`+`membershipId`+`studentId`; Q2 fail-closed; Q3
> `givenTextSnapshot` ukládat + chránit; Q4 backfill `LEGACY_INFERRED`; Q5 názvy `SubmissionFact`/
> `ResponseFact`; Q6 backfill CLI.

---

## 0. Principy návrhu (shrnutí rozhodnutí)

1. **Scalar IDs, ne relations na živé tabulky.** Snapshot je historický a nesmí spadnout/zmizet,
   když se živý `Test`/`Question`/`Student` smaže nebo soft-deletuje. Jediná relation, kterou
   povolujeme, je **mezi dvěma fact tabulkami** (`SubmissionFact ↔ ResponseFact`) — obě jsou immutable
   a vznikají/zanikají společně, takže je bezpečná.
2. **Immutable.** Po vzniku se historická pole **nemění**. Jediné povolené dodatečné zápisy jsou
   `dataQuality`/`givenTextSnapshot` při anonymizaci/opravném backfillu — viz §6.
   `isBestAttempt` **záměrně NENÍ** v `SubmissionFact` (je to odvozená, mezi pokusy se měnící hodnota →
   patří do budoucí materializované summary vrstvy, ne do immutable faktu — viz §2.1 zamítnuté).
3. **`correctAnswerSnapshot` NEUKLÁDAT** do `ResponseFact` (obhajoba §7). Pro progres stačí
   `isCorrect`/`score`/`maxScore`; answer key by zvýšil únikovou plochu.
4. **GDPR dva select profily:** agregátní (bez textů) a detailní (s `givenTextSnapshot`, jen oprávněná
   role + audit).
5. **`metadata Json?` + `snapshotVersion Int`** na obou modelech — rozšiřitelnost bez migrace za každou drobnost.

---

## 1. Doporučený Prisma model draft

> ⚠️ Toto je **návrh v dokumentaci**, ne soubor `schema.prisma`. Slouží k odsouhlasení tvaru.

### 1.1 Enumy (nové)

```prisma
/// Kvalita / úplnost analytického snapshotu. Smí se jen zhoršovat při vzniku;
/// zlepšit na COMPLETE smí pouze cílený opravný backfill.
enum AnalyticsDataQuality {
  COMPLETE          // vznikl při LIVE_SUBMIT, všechny povinné vazby dohledány
  PARTIAL           // fakt vznikl, chybí nepovinná kotva/kontext (např. studentId, classSectionId)
  LEGACY_INFERRED   // backfill z historie; kontext mohl být zpětně změněn (nižší důvěra)
  BROKEN_REFERENCE  // klíčová vazba nedohledatelná; fakt jen kvůli počtům, mimo detailní pohledy
}

/// Původ snapshotu.
enum AnalyticsSnapshotSource {
  LIVE_SUBMIT   // vznikl v transakci SubmissionsService.finish()
  BACKFILL      // vznikl dávkovým CLI jobem nad historickými submissions
}
```

`QuestionType` a `Difficulty` **znovupoužíváme** ze stávajícího schématu — nové enumy pro ně nezavádíme.

### 1.2 `SubmissionFact`

```prisma
/// Immutable analytický snapshot jednoho ODEVZDANÉHO pokusu o test.
/// Source of truth zůstává Submission/Response; tento řádek je historicky platná kopie
/// kontextu v čase odevzdání. Žádné relations na živé tabulky (kromě ResponseFact).
model SubmissionFact {
  id               String   @id @default(uuid()) @map("submission_fact_id")

  // ── Vazba na zdroj (scalar) ────────────────────────────────────────────────
  submissionId     String   @unique @map("submission_id")
  assignmentId     String   @map("assignment_id")
  testId           String   @map("test_id")
  testVersion      Int      @map("test_version")

  // ── Identita (3 kotvy, každá řeší jiný problém — §3) ───────────────────────
  organizationId   String   @map("organization_id")
  userId           String   @map("user_id")          // stabilní long-term kotva
  membershipId     String   @map("membership_id")    // = Submission.studentId; org/role/self-check
  studentId        String?  @map("student_id")        // Student.id; null → dataQuality=PARTIAL

  // ── Historický kontext (zafixovaný v čase odevzdání) ───────────────────────
  academicYearId   String?  @map("academic_year_id")
  classSectionId   String?  @map("class_section_id")  // třída v době odevzdání
  subjectId        String?  @map("subject_id")
  catalogSubjectId String?  @map("catalog_subject_id")
  topicLevelId     String?  @map("topic_level_id")
  catalogTopicId   String?  @map("catalog_topic_id")

  // ── Výsledek ───────────────────────────────────────────────────────────────
  attemptNo        Int      @map("attempt_no")
  score            Int      @map("score")             // = Submission.earnedPoints
  maxScore         Int      @map("max_score")         // = Submission.maxPoints
  percentage       Float    @map("percentage")        // score/maxScore*100; 0 když maxScore=0
  questionCount    Int      @map("question_count")
  correctCount     Int      @map("correct_count")
  incorrectCount   Int      @map("incorrect_count")
  unansweredCount  Int      @default(0) @map("unanswered_count")

  // ── Čas ────────────────────────────────────────────────────────────────────
  startedAt        DateTime? @map("started_at")       // dnes proxy = Submission.createdAt
  submittedAt      DateTime  @map("submitted_at")
  durationSec      Int?      @map("duration_sec")      // submittedAt - startedAt (hrubý odhad)

  // ── Provenience / rozšiřitelnost ──────────────────────────────────────────
  dataQuality      AnalyticsDataQuality    @default(COMPLETE) @map("data_quality")
  source           AnalyticsSnapshotSource @default(LIVE_SUBMIT)
  snapshotVersion  Int       @default(1) @map("snapshot_version")
  metadata         Json?
  createdAt        DateTime  @default(now()) @map("created_at")

  // ── Bezpečná relation jen mezi fact tabulkami ─────────────────────────────
  responseFacts    ResponseFact[]

  @@index([userId, submittedAt])
  @@index([organizationId, userId])
  @@index([membershipId, submittedAt])
  @@index([studentId, submittedAt])
  @@index([organizationId, academicYearId])
  @@index([organizationId, subjectId, submittedAt])
  @@index([catalogSubjectId, submittedAt])
  @@index([topicLevelId])
  @@index([catalogTopicId])
  @@index([membershipId, testId])         // read-time „nejlepší/poslední pokus" výpočet (ne uložený flag)
  @@index([organizationId, submittedAt])  // org timeline / heatmap
  @@index([dataQuality])
  @@map("submission_facts")
}
```

### 1.3 `ResponseFact`

```prisma
/// Immutable per-otázkový snapshot odpovědi v rámci odevzdaného pokusu.
/// Granularita pro mastery a analýzu chyb. Scalar IDs; jediná relation je na SubmissionFact.
model ResponseFact {
  id                   String   @id @default(uuid()) @map("response_fact_id")

  // ── Vazby ──────────────────────────────────────────────────────────────────
  submissionFactId     String   @map("submission_fact_id")
  submissionId         String   @map("submission_id")       // redundantní, pro přímé dotazy
  responseId           String   @unique @map("response_id")

  // ── Identita (denormalizace pro per-topic dotazy) ──────────────────────────
  organizationId       String   @map("organization_id")
  userId               String   @map("user_id")
  membershipId         String   @map("membership_id")
  studentId            String?  @map("student_id")
  academicYearId       String?  @map("academic_year_id")

  // ── Otázka (snapshot) ──────────────────────────────────────────────────────
  questionId           String   @map("question_id")
  questionOrder        Int?     @map("question_order")
  questionType         QuestionType @map("question_type")
  questionTextSnapshot String?  @map("question_text_snapshot")

  // ── Téma / předmět / obtížnost (snapshot) ─────────────────────────────────
  topicLevelId         String?  @map("topic_level_id")
  catalogTopicId       String?  @map("catalog_topic_id")
  subjectId            String?  @map("subject_id")
  difficulty           Difficulty? @map("difficulty")       // fallback z TopicLevel; jinak null

  // ── Výsledek ───────────────────────────────────────────────────────────────
  score                Int      @map("score")               // = Response.awardedPoints
  maxScore             Int      @map("max_score")           // = Response.maxPoints
  isCorrect            Boolean? @map("is_correct")
  corrected            Boolean  @default(false)
  attemptNumber        Int      @default(1) @map("attempt_number")

  // ── Osobní data (chráněné — §6) ────────────────────────────────────────────
  givenTextSnapshot    String?  @map("given_text_snapshot")

  // ── Provenience / rozšiřitelnost ──────────────────────────────────────────
  dataQuality          AnalyticsDataQuality @default(COMPLETE) @map("data_quality")
  snapshotVersion      Int      @default(1) @map("snapshot_version")
  responseTimeSec      Int?     @map("response_time_sec")    // zatím null (§2.1 analýzy)
  metadata             Json?
  createdAt            DateTime @default(now()) @map("created_at")

  submissionFact       SubmissionFact @relation(fields: [submissionFactId], references: [id], onDelete: Cascade)

  @@index([submissionFactId])
  @@index([submissionId])
  @@index([userId, topicLevelId, isCorrect])
  @@index([studentId, topicLevelId, isCorrect])
  @@index([membershipId, subjectId])
  @@index([catalogTopicId, isCorrect])
  @@index([organizationId, topicLevelId])
  @@index([questionId])
  @@map("response_facts")
}
```

---

## 2. Vysvětlení polí — `SubmissionFact`

| Pole | Req/Opt | Immutable | Odkud se plní | Proč existuje / pozn. |
|---|---|---|---|---|
| `id` | required | ano | gen | PK. |
| `submissionId` | required, **unique** | ano | `Submission.id` | idempotence (1 fakt / submission), join na zdroj. |
| `assignmentId` | required | ano | `Submission.assignmentId` | trasovatelnost zadání. |
| `testId` | required | ano | `Submission.testId` | identita testu (drží se i po `deletedAt`). |
| `testVersion` | required | ano | `Test.version` (čteno v transakci) | rozliší pokusy nad různými verzemi testu. Při backfillu nedohledatelné → viz rizika. |
| `organizationId` | required | ano | `Submission.organizationId` | tenant scope — **na každém řádku**, nikdy dopočítávat joinem. |
| `userId` | required | ano | `Membership.userId` | long-term kotva (§3). `Membership.userId` je non-null FK → vždy dostupné. |
| `membershipId` | required | ano | `Submission.studentId` | aktuální vazba org/role; self-check; gamifikace. |
| `studentId` | **optional** | ano | `Student.id` přes unique `Student.membershipId` | doménová kotva; null když `Student` chybí → `PARTIAL`. |
| `academicYearId` | optional | ano | `Assignment.yearId` | osa školních let. Null jen u rozbité historie. |
| `classSectionId` | optional | ano | `Assignment.classSectionId`; fallback aktivní `Enrollment` pro daný rok | třída v době odevzdání; null u targetType=STUDENTS bez dohledatelného enrollmentu. |
| `subjectId` | optional | ano | `Test.subjectId` ?? `topicLevel→subjectLevel→subject` | předmět. |
| `catalogSubjectId` | optional | ano | `Subject.catalogSubjectId` | stabilní katalogová osa (přežívá přejmenování `Subject`). |
| `topicLevelId` | optional | ano | `Assignment.topicLevelId` | téma přiřazení (per-assignment granularita — známé omezení). |
| `catalogTopicId` | optional | ano | `TopicLevel.catalogTopicId` | stabilní katalogové téma. |
| `attemptNo` | required | ano | `Submission.attemptNo` | pořadí pokusu. |
| `score` | required | ano | `Submission.earnedPoints` | získané body (Int; když null → 0 + downgrade quality). |
| `maxScore` | required | ano | `Submission.maxPoints` | max body. |
| `percentage` | required | ano | dopočet `score/maxScore*100` | denormalizace pro rychlé řazení/timeline; 0 když `maxScore=0`. |
| `questionCount` | required | ano | `Test.questions` count v čase odevzdání | jmenovatel pro accuracy/unanswered. |
| `correctCount` | required | ano | `COUNT(Response.isCorrect=true)` | správné odpovědi. |
| `incorrectCount` | required | ano | `COUNT(Response.isCorrect=false)` | chybné (explicitně, ne dopočet — kvůli unanswered). |
| `unansweredCount` | required (default 0) | ano | `questionCount − (correct+incorrect)` | otázky bez (validní) odpovědi; viz pozn. níže. |
| `startedAt` | optional | ano | `Submission.createdAt` (proxy) | reálný start nemáme (§2.1 analýzy) → odhad. |
| `submittedAt` | required | ano | `Submission.submittedAt` | hlavní časová osa. |
| `durationSec` | optional | ano | `submittedAt − startedAt` | hrubý odhad doby; nepoužívat jako tvrdou metriku. |
| `dataQuality` | required | jen zhoršení/oprava | dle §6 | provenience. |
| `source` | required | ano | `LIVE_SUBMIT` / `BACKFILL` | původ. |
| `snapshotVersion` | required (default 1) | ano | konstanta | verze schématu snapshotu — umožní budoucí změnu výpočtu bez ztráty staré sémantiky. |
| `metadata` | optional | volné | dle potřeby | rozšíření bez migrace (např. focus-event souhrn, flagy). |
| `createdAt` | required | ano | gen | **čas vzniku faktu**, ne odevzdání (rozlišovat od `submittedAt`). |

**Pozn. k `unansweredCount`:** „answered" = `Response` s neprázdným `givenText`. Současný flow vytváří
`Response` jen pro otázky, na které student reagoval (případně všechny při finish). `unansweredCount`
je proto **rozumně dopočitatelný** jako `questionCount − answeredCount`; pokud by se ukázalo, že
prázdné odpovědi vznikají i pro nevyplněné otázky, je definice „answered" = `givenText != ''`.

### 2.1 Zamítnutá pole na `SubmissionFact`

- **`isBestAttempt` → NEUKLÁDAT do `SubmissionFact`.** `SubmissionFact` je **immutable** snapshot jednoho
  pokusu. „Nejlepší pokus" je ale **odvozená, mezi pokusy se měnící** hodnota: když student udělá další
  pokus téhož testu, flag na starším faktu by se musel přepsat → to porušuje immutabilitu a zanáší do
  faktu mutaci, kterou je nutné držet konzistentní napříč řádky.
  - **Kam místo toho:** počítat **on-demand při čtení** (`GROUP BY (kotva, testId)` s `MAX(score)`,
    využije index `[membershipId, testId]`), nebo později materializovat do **summary vrstvy**
    (`StudentTestSummary` / `StudentTopicMastery` — Fáze 6), která je explicitně přepočítávaná a smí mutovat.
  - Tím zůstává `SubmissionFact` čistě immutable a „nejlepší pokus" žije tam, kde mutace patří.

---

## 3. Přesné důvody pro `userId` / `membershipId` / `studentId`

Tři kotvy, protože **každá odpovídá na jinou analytickou otázku** a žádná sama nestačí:

| Kotva | Co umí | Co neumí | Kdy je primární |
|---|---|---|---|
| `userId` | Spojí historii **přes re-enrollment** (odejde → vrátí se → nový membership i nový Student, ale **stejný User**). | Přes organizace nerozlišuje (proto vždy páruj s `organizationId`). | **Multi-year / long-term profil** žáka. |
| `membershipId` | Aktuální vazba na org + roli; rychlý **self-check** a tenant scope; klíč pro gamifikaci/XP. | Zaniká při soft-delete membershipu → tříští dlouhodobou historii. | Operativní dotazy v rámci jednoho členství; autorizace. |
| `studentId` (`Student.id`) | Doménové vazby na `Enrollment`/`ClassSection`/promotion; „žák jako entita školy". | Nemusí být kontinuální přes re-enrollment (onboarding může vytvořit nový `Student`); může chybět → `PARTIAL`. | Třídní/ročníkové pohledy uvnitř jednoho členství. |

**Závěr:** `userId` = osa pro „celé období", `membershipId` = osa pro „v této organizaci/roli",
`studentId` = osa pro „vazby na třídy/ročníky". Ukládáme **všechny tři**, dotazy si vyberou podle use-case.

> Známé riziko (z plánu §1.4): pokud má jeden `User` více souběžných members­hipů v různých org,
> `userId+organizationId` to korektně oddělí. Sjednocování více `Student` řádků pod jedním `userId`
> je mimo Fázi 2 (samostatný identity plán).

---

## 4. Vysvětlení polí — `ResponseFact` (jen odlišnosti)

| Pole | Req/Opt | Odkud | Pozn. |
|---|---|---|---|
| `submissionFactId` | required | FK | jediná relation (cascade delete s faktem submission). |
| `submissionId` | required | `Submission.id` | redundance pro přímé dotazy bez joinu. |
| `responseId` | required, **unique** | `Response.id` | idempotence per odpověď. |
| `questionId` | required | `Response.questionId` | identita otázky. |
| `questionOrder` | optional | `Question.order` | pořadí; `Question.order` je `Int?` → optional. |
| `questionType` | required | `Question.type` | `QuestionType` (FILL_IN_THE_BLANK/MULTIPLE_CHOICE/TRUE_FALSE). |
| `questionTextSnapshot` | optional | `Response.questionTextSnapshot` | už dnes snapshotováno na Response → přeneseme. |
| `topicLevelId` / `catalogTopicId` / `subjectId` | optional | jako u SubmissionFact | denormalizace pro per-topic agregace. |
| `difficulty` | optional | `TopicLevel.difficulty` | **fallback** — otázka vlastní obtížnost nemá (§2.2 plánu); null = UNKNOWN. |
| `score` / `maxScore` | required | `Response.awardedPoints` / `maxPoints` | body za otázku. |
| `isCorrect` | **optional** | `Response.isCorrect` | `Response.isCorrect` je `Boolean?` (null = nehodnoceno) → držíme nullable. |
| `corrected` | required (default false) | `Response.corrected` | příznak opravy. |
| `attemptNumber` | required (default 1) | `Response.attemptNumber` | pokus per odpověď. |
| `givenTextSnapshot` | optional | `Response.givenText` | osobní data — chráněno (§6). |
| `responseTimeSec` | optional | budoucí | zatím null. |
| `dataQuality`/`snapshotVersion`/`metadata`/`createdAt` | — | — | jako SubmissionFact. |

### 4.1 Zvážená volitelná pole (rozhodnutí)

- **`selectedOptionIdsSnapshot Json?` → NEPŘIDÁVAT (zatím).** Důvod: současný model **neukládá výběr
  jako option IDs**. `Option` nemá `order` ani stabilní referenci ve výsledku; odpověď se serializuje
  do `Response.givenText` (text možnosti / JSON pole textů). Snapshot ID možností by vyžadoval křehké
  párování textu na `Option.id` a nepřinesl by nic navíc nad `givenTextSnapshot`. Pokud později vznikne
  stabilní `Option.id` ve výsledku, lze přidat přes `metadata` bez migrace.
- **`correctAnswerSnapshot` → NEUKLÁDAT.** Viz samostatná obhajoba §7.
- **`explanationSnapshot` → NEUKLÁDAT (zatím).** `explanation`/`feedback` žijí na `Response`, ne na
  `Question`, a jsou to **didaktická/učitelská data**, ne signál o výkonu žáka. Pro progres/mastery
  nepotřebné, pro detailní review je lze dohledat živě z `Response`. Když by bylo potřeba (immutable
  review), přidat cíleně později nebo přes `metadata`.

---

## 5. Indexy a unique constraints

### 5.1 Unique
| Tabulka | Unique | Důvod |
|---|---|---|
| `SubmissionFact` | `submissionId` | 1 fakt / submission — idempotence + ochrana proti duplicitě (Q2). |
| `ResponseFact` | `responseId` | 1 fakt / odpověď — `createMany({ skipDuplicates: true })`. |

> Pozn.: NEděláme unique na `(userId, testId, attemptNo)` — `attemptNo` je per assignment, ne per test,
> a víc assignmentů téhož testu by kolidovalo. `submissionId` unique je dostatečné a korektní.

### 5.2 Indexy → use-case mapping
| Use-case | Index |
|---|---|
| Detail žáka přes celé období | `SubmissionFact [userId, submittedAt]` |
| Detail žáka v organizaci | `SubmissionFact [organizationId, userId]` |
| Progres podle membershipId | `SubmissionFact [membershipId, submittedAt]` |
| Progres podle studentId | `SubmissionFact [studentId, submittedAt]` |
| Progres podle školního roku | `SubmissionFact [organizationId, academicYearId]` |
| Progres podle předmětu | `SubmissionFact [organizationId, subjectId, submittedAt]`, `[catalogSubjectId, submittedAt]` |
| Progres podle tématu | `SubmissionFact [topicLevelId]`, `[catalogTopicId]`; `ResponseFact [userId/studentId, topicLevelId, isCorrect]` |
| Timeline testů | `SubmissionFact [userId, submittedAt]` / `[organizationId, submittedAt]` |
| Dohledání factu podle submissionId | `SubmissionFact @unique(submissionId)` |
| Response facts podle submissionFactId | `ResponseFact [submissionFactId]` |
| Read-time „nejlepší/poslední pokus" | `SubmissionFact [membershipId, testId]` (flag se neukládá — §2.1) |
| Class topic stats | `ResponseFact [organizationId, topicLevelId]`, `[catalogTopicId, isCorrect]` |
| Backfill: najít chybějící fakty | `SubmissionFact @unique(submissionId)` (anti-join) |

> Indexů je hodně — při implementaci **zvážit, které reálně potřebujeme od první verze** (každý index
> zpomaluje zápis). Doporučení: začít s unique + `[userId, submittedAt]`, `[organizationId, userId]`,
> `[membershipId, testId]`, `ResponseFact [submissionFactId]` a `[*, topicLevelId, isCorrect]`; zbytek
> přidat podle reálných read endpointů. Viz otevřené otázky §8.

---

## 6. GDPR / retence

### 6.1 Dva read profily (vynucení)
- **`aggregateSafeSelect`** — pro timeline, mastery, class/org rollupy, exporty agregací.
  **Nikdy** neobsahuje `givenTextSnapshot` (ani `questionTextSnapshot`, pokud není nutné).
  Defaultní profil pro většinu endpointů.
- **`responseDetailSelect`** — per-otázkový detail review chyb. Obsahuje `givenTextSnapshot`.
  Dostupný jen oprávněné roli (učitel třídy / oprávněná autorita), s **auditem** (`AuditLog`,
  `action: ANALYTICS_RESPONSE_DETAIL_READ`).

Doporučení: definovat oba profily jako sdílené Prisma `select` konstanty, aby se osobní text
nemohl omylem prosáknout do agregací.

### 6.2 Anonymizace (`User.anonymized = true`)
| Pole | Akce | Důvod |
|---|---|---|
| `givenTextSnapshot` | **smazat / nullnout** (redakce) | volný text žáka = nejcitlivější; není nutný pro statistiky. |
| `userId` / `membershipId` / `studentId` | **ponechat** (default) nebo **pseudonymizovat** | viz rozhodnutí níže. |
| `score`/`maxScore`/`percentage`/counts | **ponechat** | agregovaná školní statistika musí přežít (oprávněný zájem školy). |
| `questionTextSnapshot` | ponechat | není osobní údaj žáka. |

**Doporučení k identitě při anonymizaci:** **ponechat** `userId/membershipId/studentId` jako interní
identifikátory (jsou to UUID bez osobního obsahu), ale zaručit, že přes ně **nelze dohledat osobní
údaje** (jméno/email jsou anonymizované v `User`). Tím zůstanou agregáty konzistentní (počítají se
podle stabilních ID), ale nevedou k identifikaci osoby. Alternativa (tvrdší): nahradit je jedním
`anonymizedSubjectKey` — větší zásah, řešit až s DPO (otevřená otázka §8).

### 6.3 Retence
- Agregovaná fakta (skóre, counts, téma) — držet pro dlouhodobý reporting školy.
- `givenTextSnapshot` — **kratší retence** než agregáty (konkrétní lhůtu určí DPO); po lhůtě redigovat
  i bez anonymizace uživatele.
- Po odchodu žáka (`Enrollment LEFT/GRADUATED`) — fakta zůstávají (reporting), osobní text dle retenční lhůty.

---

## 7. Rozhodnutí: `correctAnswerSnapshot` — NEUKLÁDAT (obhajoba)

Předběžná preference byla neukládat; **potvrzuji a obhajuji**:

**Pro neukládání (převažuje):**
- **Pro progres/mastery je zbytečné** — výkon žáka plně popisují `isCorrect`, `score`, `maxScore`.
  Správná odpověď nepřidává žádný agregovatelný signál.
- **Bezpečnost / answer-key leak** — `ResponseFact` je analytická tabulka, kterou budou číst
  širší role (učitel, později reporting). Mít v ní kompletní klíč správných odpovědí ke každé
  otázce = zbytečná úniková plocha (export, log, mis-scoped query).
- **Redundance** — `Response.correctAnswerSnapshot` už **existuje na zdrojové tabulce** (immutable).
  Pro výjimečný hloubkový audit otázky se dá dohledat tam, s přísnějším přístupem.
- **Retence** — méně kopií citlivějšího obsahu = jednodušší GDPR.

**Proti (kdyby někdo chtěl ukládat):**
- Plně immutable review otázky „na jednom místě" bez joinu na `Response`. → Slabé; join je levný.

**Závěr:** `correctAnswerSnapshot` **do `ResponseFact` nepatří.** Pokud v budoucnu vznikne potřeba
immutable answer-key auditu, řešit přes oddělenou, přísně chráněnou tabulku — ne přes analytická fakta.

---

## 8. Otevřené otázky před migrací

1. **Rozsah indexů ve v1** — vytvořit všechny navržené, nebo minimální sadu a dořešit podle read
   endpointů? *(doporučení: minimální sada, viz §5.2 pozn.)*
2. **Anonymizace identity** — ponechat UUID kotvy vs. nahradit `anonymizedSubjectKey`? *(rozhodnout s DPO.)*
3. **Retenční lhůta `givenTextSnapshot`** — konkrétní doba (např. 12/24 měsíců po odchodu)? *(DPO.)*
4. **`testVersion` při backfillu** — `Test.version` je živé pole; historickou verzi v čase odevzdání
   nemáme. Backfill zapíše aktuální `version` + `dataQuality=LEGACY_INFERRED`, nebo `0`/`null`-sentinel?
   *(doporučení: aktuální version + LEGACY_INFERRED.)*
5. **`metadata` schéma** — definovat lehký konvenční tvar (např. `{ focusEvents?: n, flags?: [...] }`),
   ať se nestane z `Json?` smetiště? *(doporučení: ano, dokumentovat konvenci.)*
6. **„Nejlepší pokus"** — řešit on-demand při čtení (index `[membershipId, testId]`), nebo až materializovat
   do summary vrstvy ve Fázi 6? `isBestAttempt` se do `SubmissionFact` **nepřidává** (§2.1). *(doporučení: on-demand teď.)*
7. **Soft-delete faktů** — když se zdrojová `Submission.deletedAt` nastaví, fakt mažeme, tombstonujeme,
   nebo necháme + flag? *(doporučení: necháme + `metadata.sourceDeletedAt`, ať agregáty drží; vyloučit
   z osobního detailu.)*

---

## 9. Checklist pro budoucí implementaci migrace

1. **Odsouhlasit tvar modelů** (tento dokument) + rozhodnout otevřené otázky §8.
2. Přidat enumy `AnalyticsDataQuality`, `AnalyticsSnapshotSource` do `schema.prisma`.
3. Přidat modely `SubmissionFact`, `ResponseFact` (+ relace mezi nimi; backref `responseFacts` na
   `SubmissionFact`).
4. Vygenerovat migraci (aditivní — **žádná změna existujících tabulek**, viz §10).
5. Indexy dle zvolené sady (§5.2).
6. Ověřit, že žádný FK nemíří na živé doménové tabulky (jen `ResponseFact.submissionFactId`).
7. `prisma generate` + typová kontrola.
8. (Až poté, samostatné PR) snapshot service + integrace do `finish()` + backfill CLI + testy (§7/§9 plánu).

---

## 10. Závěr

### Finální návrh modelů
- **`SubmissionFact`** — 1:1 se `Submission` (`@unique submissionId`), 3 identitní kotvy
  (`userId` required, `membershipId` required, `studentId` optional), historický kontext jako scalar IDs,
  výsledkové metriky vč. `unansweredCount`, provenience (`dataQuality`/`source`/`snapshotVersion`/`metadata`).
  **Plně immutable** (žádný `isBestAttempt` — §2.1). Relation jen na `ResponseFact`.
- **`ResponseFact`** — 1:1 s `Response` (`@unique responseId`), denormalizované kotvy + téma/předmět/
  obtížnost, výsledek per otázka, `givenTextSnapshot` jako chráněné osobní pole. **Bez** `correctAnswerSnapshot`,
  `explanationSnapshot`, `selectedOptionIdsSnapshot` (zdůvodněno §4.1/§7).
- **2 nové enumy**; `QuestionType`/`Difficulty` znovupoužity.

### Jaké soubory se změnily
- **Vytvořen:** `docs/analytics/student-progress-prisma-models.md` (tento dokument).
- Žádný kód, žádná migrace, žádná změna `schema.prisma`, žádný commit.

### Vyžaduje návrh změnu ve stávajícím `schema.prisma`?
- **Pro Fázi 2 ne — návrh je čistě aditivní** (2 enumy + 2 modely + relace mezi nimi). Stávající modely
  se nemění; `SubmissionFact`/`ResponseFact` drží jen scalar IDs, takže není nutné přidávat na
  `Submission`/`Response`/`User`/`Student` žádná back-relation pole.
- **Volitelně (ne nutně):** později back-relace `Submission.fact SubmissionFact?` pro pohodlí dotazů —
  ale to už je drobná změna existujícího modelu, kterou pro snapshot **nepotřebujeme** a záměrně ji
  vynecháváme (snapshot nesmí být závislý na živé tabulce).

### Největší riziko
1. **`testVersion`/kontext při backfillu** — historickou verzi a původní mapování témat zpětně
   nezrekonstruujeme; backfill bude nutně `LEGACY_INFERRED`. Riziko, že někdo bude brát backfillovaná
   čísla jako „pravdu". Mitigace: důsledně `dataQuality` + UI disclaimer.
2. **`studentId` kontinuita** — `userId` je správná long-term kotva, ale dokud onboarding neumí
   sjednotit `Student` přes re-enrollment, budou `studentId`-based pohledy v takových případech dělené.
   Mitigace: pro multi-year primárně `userId`.
3. **Šíře indexů vs. zápisová cena** — fail-closed zápis je v transakci `finish()`; příliš mnoho indexů
   zpomalí odevzdání testu. Mitigace: minimální index sada ve v1 (§5.2).
4. **GDPR únik `givenTextSnapshot`** — největší citlivost; stojí a padá na disciplíně dvou select
   profilů (§6.1). Mitigace: select profily jako sdílené konstanty + audit detailních čtení.
```
