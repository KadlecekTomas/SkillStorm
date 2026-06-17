# Fáze 2 — Immutable analytics snapshot: implementační plán

> **Status:** plán / RFC. **Nic se neimplementuje.** Žádný kód, žádná Prisma migrace, žádný commit.
> Tento dokument je přesný podklad pro zavedení neměnných analytických snapshotů po odevzdání testu.
> Navazuje na [student-progress-analysis.md](student-progress-analysis.md) (zejm. §2, §4, §11 Fáze 2).
>
> **Datum:** 2026-06-16
> **Předmět:** `SubmissionFact` + `ResponseFact` jako základ dlouhodobého (multi-year) progresu žáka,
> včetně bezpečného ukotvení identity `membershipId → Student.id` **bez globálního refactoru identity**.

---

## 0. Proč Fáze 2 a co je její jádro

Dlouhodobý progres přes ročníky nelze stavět na živých joinech (`Submission → Test → TopicLevel → Subject`),
protože ty se **zpětně mění** (editace testu, přemapování tématu, archivace testu) a identita žáka je
vázaná na `Membership`, který je per-org a může zaniknout/vzniknout znovu. Fáze 2 proto vytvoří
**neměnný řádek faktu** s historicky platným kontextem v okamžiku odevzdání a **stabilní kotvou identity**.

Klíčové rozhodnutí tohoto plánu (**schváleno 2026-06-16**): **snapshotovat současně tři identifikátory** —
`userId` (stabilní long-term kotva přes re-enrollment), `membershipId` (aktuální vazba na org/role)
a `studentId` = `Student.id` (doménová kotva žáka) — s explicitním stavem `dataQuality`, když `Student.id`
nelze v čase odevzdání bezpečně dohledat. Každý identifikátor řeší jiný analytický problém (viz §1.6).

---

## 1. Current-state audit

### 1.1 Kde se dnes používá `Submission.studentId`
Ověřeno grepem v `server/src`:

| Místo | Použití | Poznámka |
|---|---|---|
| `submissions.service.ts:356/368/385` | `create()` zapisuje `studentId: membership.id` | **zápis = membershipId** |
| `submissions.service.ts:430/539/937/1006` | self-check `submission.studentId !== membership.id` | porovnává s `membership.id` |
| `submissions.service.ts:755/765` | gamifikace `awardXpForEvent(submission.studentId, …)` | bere membershipId |
| `submissions.service.ts:811/812` | `findAll` filtr `where.studentId = membership.id` | membershipId |
| `analytics.service.ts:630/779` | `bucket.studentIds.add(r.submission.studentId)` | počítá unikátní žáky z membershipId |
| `stats.service.ts` (student dashboard, at-risk) | `studentId: effectiveMembershipId` | membershipId |
| `student-analytics-query.util.ts` | `studentId: scope.membershipId` | membershipId |
| `assignments.service.ts` (test session) | `startedAt = submission.createdAt` | žádný reálný start |

**Závěr:** všechna místa zacházejí s `Submission.studentId` jako s **membershipId**.

### 1.2 Znamená `Submission.studentId` reálně `Membership.id`? — **ANO.**
V `schema.prisma` (model `Submission`):
```prisma
student  Membership @relation(fields: [studentId], references: [id], onDelete: Cascade)
```
FK míří na `Membership.id`. Pojmenování `studentId` je zavádějící — jde o **membershipId**.
Žádná část kódu nepoužívá `Submission.studentId` jako `Student.id`.

### 1.3 Jak bezpečně dohledat `Student.id` ze `Submission.studentId`
- `Student.membershipId` je `@unique` (1:1 s membership).
- Resolver: `prisma.student.findUnique({ where: { membershipId: submission.studentId } })`.
- **Podmínky bezpečnosti:**
  - membership musí mít roli `STUDENT` (jinak `Student` neexistuje — např. submission učitele teoreticky nevznikne, ale audit ukazuje, že `create()` vyžaduje roli STUDENT — viz `submissions.service.ts:284`).
  - `Student.deletedAt` může být nastaven (soft-delete) — pro snapshot to **není** důvod nedohledat (kotva má přežít odchod žáka). Resolvujeme i soft-deleted.
  - hrana: membership STUDENT bez `Student` řádku (datová nekonzistence z importu) → `Student.id` = `null` → `dataQuality = PARTIAL` (viz §6).

### 1.4 Kde hrozí problém při dlouhodobé analytice
- **Re-enrollment / odchod a návrat:** nový `Membership` (nové `membershipId`) → submissions ze starého a nového členství mají různý `studentId`. Bez kotvy `Student.id` se profil **rozpadne na dvě osoby**.
  - ⚠️ **Pozor:** dnes `Student.membershipId` je 1:1; není zaručeno, že po návratu žáka vznikne **stejný** `Student` řádek. Pokud onboarding vytvoří **nový** `Student`, ani `Student.id` nezajistí kontinuitu napříč členstvími. Skutečně stabilní napříč re-enrollmentem je až `User.id`. (Viz rozhodnutí §10 — Q1.)
- **Editace testu/tématu po odevzdání:** živý join přepíše historii (řešeno snapshotem).
- **Archivace/smazání testu:** `buildCompletedStudentSubmissionWhere` filtruje `test.deletedAt: null` → historie zmizí (řešeno snapshotem, který je nezávislý na živém testu).
- **Přestup mezi třídami:** `Enrollment` se mění; třída „v době odevzdání" není jednoznačně dohledatelná zpětně (řešeno `classSectionId` snapshotem).

### 1.5 Je `membershipId` dostatečně stabilní pro **jednu** organizaci?
- **V rámci jednoho aktivního členství: ANO** — `membershipId` je stabilní identifikátor žáka v org pro celé jeho působení (i přes více ročníků), dokud membership není soft-deleted a znovu vytvořen.
- **Přes opětovné členství v téže org: NE** — soft-delete + nové membership = nové `membershipId`.
- **Přes organizace: NE** (a ani to nechceme — analytika je tenant-scoped).

### 1.6 Kdy je nutné snapshotovat `userId`, `Student.id` i `membershipId`
**Vždy všechny tři** (schváleno §10-Q1) — každý řeší jiný analytický problém:
- `userId` (`Membership.userId`, vždy non-null) — **nejstabilnější long-term kotva**: přežívá soft-delete
  membershipu i re-enrollment (nový `Membership` i nový `Student`, ale **stejný** `User`). Toto je primární
  osa pro multi-year/cross-membership progres.
- `membershipId` — aktuální/historická vazba na org, role, gamifikaci; rychlé self-checky a tenant scope.
- `studentId` (`Student.id`) — doménová kotva žáka pro vazby na `Enrollment`/`ClassSection`; stabilní
  v rámci jednoho členství. Pokud nejde v čase odevzdání dohledat → `null` + `dataQuality = PARTIAL` (nikdy nefailovat).

---

## 2. Návrh Prisma modelů (NEIMPLEMENTOVAT)

> Pole níže jsou návrh. Názvy modelů: doporučuji **`SubmissionFact`** a **`ResponseFact`**
> (kratší, konzistentní s doménovým slovníkem). Mapování tabulek `submission_facts` / `response_facts`.

### 2.1 `SubmissionFact`

| Pole | Typ | Req/Opt | Proč existuje | Odkud se plní | Immutable | Index |
|---|---|---|---|---|---|---|
| `id` | `String @id uuid` | required | PK faktu | generováno | ano | PK |
| `submissionId` | `String @unique` | required | 1:1 vazba na zdroj, idempotence | `Submission.id` | ano | unique |
| `studentId` | `String?` | **optional** | stabilní kotva pro multi-year | `Student.id` přes `membershipId` (může být null) | ano | `[studentId, submittedAt]` |
| `membershipId` | `String` | required | aktuální vazba, tenant/self-check | `Submission.studentId` | ano | součást org indexů |
| `userId` | `String` | **required** | nejstabilnější long-term kotva (přežívá re-enrollment) | `Membership.userId` (vždy non-null FK) | ano | `[userId, submittedAt]` |
| `organizationId` | `String` | required | tenant scope | `Submission.organizationId` | ano | `[organizationId, academicYearId, subjectId]` |
| `assignmentId` | `String` | required | trasovatelnost zadání | `Submission.assignmentId` | ano | — |
| `testId` | `String` | required | identita testu | `Submission.testId` | ano | — |
| `testVersion` | `Int` | required | verze testu v čase odevzdání | `Test.version` (čteno v transakci) | ano | — |
| `academicYearId` | `String?` | optional | školní rok (multi-year osa) | `Assignment.yearId` | ano | `[studentId, academicYearId]` |
| `classSectionId` | `String?` | optional | třída **v době odevzdání** | `Assignment.classSectionId`; fallback z `Enrollment` (viz pozn.) | ano | `[classSectionId, submittedAt]` |
| `subjectId` | `String?` | optional | předmět | `Test.subjectId` ?? `topicLevel→subjectLevel→subject` | ano | viz org index |
| `catalogSubjectId` | `String?` | optional | stabilní katalogový předmět | `Subject.catalogSubjectId` | ano | — |
| `topicLevelId` | `String?` | optional | téma přiřazení | `Assignment.topicLevelId` | ano | `[topicLevelId]` |
| `catalogTopicId` | `String?` | optional | stabilní katalogové téma | `TopicLevel.catalogTopicId` | ano | — |
| `score` | `Int` | required | získané body | `Submission.earnedPoints` | ano | — |
| `maxScore` | `Int` | required | max body | `Submission.maxPoints` | ano | — |
| `percentage` | `Float` | required | denormalizace `score/maxScore*100` | dopočet (0 když maxScore=0) | ano | — |
| `questionCount` | `Int` | required | počet otázek | `COUNT(responses)` / `test.questions` | ano | — |
| `correctCount` | `Int` | required | správné | `COUNT(isCorrect=true)` | ano | — |
| `incorrectCount` | `Int` | required | chybné | `questionCount − correctCount` | ano | — |
| `difficultyBreakdown` | `Json?` | optional | rozpad dle obtížnosti | z `ResponseFact.difficulty` agregace | ano | — |
| `questionTypeBreakdown` | `Json?` | optional | rozpad dle typu otázky | agregace `Response.question.type` | ano | — |
| `attemptNo` | `Int` | required | pořadí pokusu | `Submission.attemptNo` | ano | — |
| `startedAt` | `DateTime?` | optional | start pokusu (dnes = createdAt) | `Submission.createdAt` (známé omezení §2.1 analýzy) | ano | — |
| `submittedAt` | `DateTime` | required | čas odevzdání | `Submission.submittedAt` | ano | součást indexů |
| `durationSec` | `Int?` | optional | doba (hrubý odhad) | `submittedAt − startedAt` | ano | — |
| `dataQuality` | `enum` | required | kvalita/úplnost dat | dle §6 | **mutovatelný jen backfillem→COMPLETE** | `[dataQuality]` (volitelně) |
| `snapshotSource` | `enum` | required | `LIVE` / `BACKFILL` | dle původu zápisu | ano | — |
| `createdAt` | `DateTime @default(now())` | required | čas vzniku faktu (ne odevzdání!) | generováno | ano | — |

**Pozn. k `classSectionId`:** primárně `Assignment.classSectionId`. Když je `null` (targetType=STUDENTS),
fallback = aktivní `Enrollment` žáka pro `Assignment.yearId` v době odevzdání. Pokud ani to nelze →
`null` + downgrade `dataQuality` na `PARTIAL`.

**Indexy (souhrn):**
```
@@unique([submissionId])
@@index([studentId, submittedAt])
@@index([studentId, subjectId, submittedAt])
@@index([studentId, academicYearId])
@@index([membershipId, testId])           // best-attempt přepočet
@@index([organizationId, academicYearId, subjectId])
@@index([classSectionId, submittedAt])
@@index([topicLevelId])
```

### 2.2 `ResponseFact`

| Pole | Typ | Req/Opt | Proč existuje | Odkud se plní | Immutable | Index |
|---|---|---|---|---|---|---|
| `id` | `String @id uuid` | required | PK | generováno | ano | PK |
| `submissionFactId` | `String` | required | vazba na `SubmissionFact` | FK | ano | `[submissionFactId]` |
| `submissionId` | `String` | required | redundantní trasovatelnost | `Submission.id` | ano | — |
| `responseId` | `String @unique` | required | 1:1 zdroj, idempotence | `Response.id` | ano | unique |
| `studentId` | `String?` | optional | denormalizovaná kotva pro per-topic dotazy | jako u SubmissionFact | ano | `[studentId, topicLevelId, submittedAt]` |
| `membershipId` | `String` | required | tenant/fallback identita | `Submission.studentId` | ano | — |
| `organizationId` | `String` | required | tenant scope | `Submission.organizationId` | ano | — |
| `academicYearId` | `String?` | optional | osa let | `Assignment.yearId` | ano | — |
| `questionId` | `String` | required | identita otázky | `Response.questionId` | ano | — |
| `questionType` | `QuestionType` | required | typ otázky | `Question.type` (čteno v transakci) | ano | — |
| `questionOrder` | `Int?` | optional | pořadí otázky | `Question.order` | ano | — |
| `questionTextSnapshot` | `String?` | optional | neměnný text (už existuje na Response) | `Response.questionTextSnapshot` | ano | — |
| `topicLevelId` | `String?` | optional | téma (snapshot) | `Assignment.topicLevelId` | ano | `[topicLevelId, isCorrect]` |
| `catalogTopicId` | `String?` | optional | katalogové téma | `TopicLevel.catalogTopicId` | ano | — |
| `subjectId` | `String?` | optional | předmět | jako u SubmissionFact | ano | `[studentId, subjectId, submittedAt]` |
| `difficulty` | `Difficulty?` | optional | obtížnost (fallback, viz níže) | `TopicLevel.difficulty`; jinak `null` | ano | — |
| `score` | `Int` | required | body za otázku | `Response.awardedPoints` | ano | — |
| `maxScore` | `Int` | required | max body otázky | `Response.maxPoints` | ano | — |
| `isCorrect` | `Boolean` | required | správnost | `Response.isCorrect` (po vyhodnocení) | ano | — |
| `givenTextSnapshot` | `String?` | optional | odpověď žáka — pro detailní review chyb (zejm. textové odpovědi) | `Response.givenText` | ano | — |
| `corrected` | `Boolean @default(false)` | required | oprava | `Response.corrected` | ano | — |
| `attemptNumber` | `Int @default(1)` | required | pokus per odpověď | `Response.attemptNumber` | ano | — |
| `responseTimeSec` | `Int?` | optional | per-otázkový čas (zatím null) | budoucí (§2.1 analýzy) | ano | — |
| `submittedAt` | `DateTime` | required | čas odevzdání | `Submission.submittedAt` | ano | součást indexů |
| `dataQuality` | `enum` | required | kvalita | dle §6 | jen backfill→COMPLETE | — |
| `createdAt` | `DateTime @default(now())` | required | vznik faktu | generováno | ano | — |

**Difficulty fallback (otázka nemá obtížnost):**
1. `TopicLevel.difficulty` z přiřazení (pokud `topicLevelId` existuje).
2. Jinak `null` + příznak v `difficultyBreakdown` jako `UNKNOWN`.
3. Mastery model (§8 analýzy) zachází s `null` jako s `BASIC` váhou, ale **netrestá** za neznámou
   obtížnost. (Budoucí: přidat `Question.difficulty` — mimo Fázi 2.)

**`questionTextSnapshot` vs. jen `questionOrder`:** text už dnes na `Response` snapshotujeme,
takže ho přeneseme. Schváleno (§10-Q3): **snapshot textu ponecháváme** (konzistence s historií).

**Retence/GDPR pro `givenTextSnapshot` (schváleno §10-Q3):** ukládáme, protože je klíčový pro
detailní review chyb u textových odpovědí, ale:
- **nikdy** se nepouští do běžných agregovaných view (timeline, mastery, class/org rollupy) —
  je dostupný jen v cíleném per-otázkovém detailu (učitel, oprávněná role, s auditem),
- podléhá **retenční politice** (kratší než agregovaná fakta) a **anonymizaci** při anonymizaci
  uživatele (`User.anonymized` → `givenTextSnapshot` se rediguje, agregovatelná pole zůstávají),
- viz §6 pro vynucení na úrovni dotazů a §9 původní analýzy pro retenci.

### 2.3 Nové enumy (návrh)
```prisma
enum AnalyticsDataQuality { COMPLETE  PARTIAL  LEGACY_INFERRED  BROKEN_REFERENCE }
enum AnalyticsSnapshotSource { LIVE  BACKFILL }
```

---

## 3. Immutable pravidla

1. **Vznik:** `SubmissionFact` + `ResponseFact[]` se vytvoří **jednou**, při úspěšném `finish()`
   (přechod do `APPROVED`/`REJECTED`, tj. když je `submittedAt` poprvé nastaveno).
2. **Neměnnost:** po vytvoření se **žádné historické pole nemění**. `SubmissionFact` je plně immutable
   (žádný `isBestAttempt` — „nejlepší pokus" se počítá on-demand / v summary vrstvě, viz prisma-models §2.1).
   Jediná povolená dodatečná mutace:
   - `dataQuality: PARTIAL/LEGACY_INFERRED → COMPLETE` výhradně **opravným backfillem** (nikdy v běžném provozu).
3. **Editace testu po odevzdání nesmí změnit fakt:** fakt nečte `Test`/`Question`/`TopicLevel` živě.
   Veškerý kontext je zkopírovaný. (Test může být i smazán — fakt přežívá.)
4. **Opakovaný submit netvoří duplicitu:** `finish()` je idempotentní (vrací existující submission,
   pokud `submittedAt != null`). Snapshot navíc chrání **`@unique(submissionId)`** → druhý zápis selže/no-op.
5. **Idempotentní chování při existujícím faktu:**
   - Při `finish()`: pokud `SubmissionFact` pro `submissionId` už existuje → **neprovádět zápis** (no-op).
   - Implementace: `upsert` na `submissionId` s `create`-only sémantikou, nebo `createMany({ skipDuplicates: true })` + guard.
   - `ResponseFact` chráněn `@unique(responseId)` → `skipDuplicates`.
6. **Konzistence zdroj↔fakt:** fakt vzniká **ve stejné DB transakci** jako finalizace submission
   (viz §4) → buď je submission `APPROVED` i s faktem, nebo nic.

---

## 4. Integrace do backendu

### 4.1 Kde
`SubmissionsService.finish()` (`server/src/submissions/submissions.service.ts`, blok `$transaction`
po výpočtu skóre, řádky ~562–752). Tam už máme: vyhodnocené `Response` (s `isCorrect/awardedPoints/
maxPoints/snapshoty`), spočtený `scoreResult`, `submission.update` na `APPROVED`/`REJECTED`.

### 4.2 Co musí být v transakci (synchronně)
- Čtení kontextu, které **musí** být konzistentní s odevzdáním: `Test.version`, `Assignment`
  (`yearId`, `classSectionId`, `topicLevelId`), `Subject`/`catalogSubjectId`, `TopicLevel.catalogTopicId/difficulty`.
- Resolve `Student.id` z `membershipId` (a volitelně `userId`).
- Zápis `SubmissionFact` (create-only dle `submissionId`).
- Zápis `ResponseFact[]` (`createMany skipDuplicates`).

> **Doporučení:** snapshot **uvnitř** existující `$transaction` ve `finish()`. Objem dat je malý
> (jednotky až desítky otázek), kontext už z větší části načítáme. Atomicita > mikrovýkon.

### 4.3 Co může být async
- Přepočet materializovaného `StudentTopicMastery` (Fáze 6) — **mimo** Fázi 2.
- Invalidace versioned cache (už dnes `invalidateSubmissionDerivedCaches`, fire-and-forget).
- Logování `dataQuality != COMPLETE` do `AuditLog` (fire-and-forget).

### 4.4 Co se stane při chybě zápisu snapshotu
- **Uvnitř transakce:** chyba → rollback celé `finish()` → submission zůstane neuzavřená →
  student může submit zopakovat. **Riziko:** chyba ve snapshotu by blokovala odevzdání.
  - **Mitigace:** snapshot logika musí být **defenzivní** — chybějící vazba ≠ exception, ale
    `null` + `dataQuality = PARTIAL`. Skutečnou exception vyhodí jen DB chyba (např. constraint),
    což je správný důvod k rollbacku.
- **Rozhodnuto (§10-Q2): fail-closed pro nové submity.** Snapshot je v transakci `finish()`; pokud
  nevznikne (skutečná DB chyba), celé `finish()` se rollbackne a submission zůstane neuzavřená —
  raději ať student submit zopakuje, než aby vznikla díra v analytice. **Backfill se chová opačně**
  (§5): fail **per item** + log, jeden vadný řádek nesmí shodit celou dávku.

### 4.5 Jak zabránit nekonzistenci Submission ↔ Fact
- Fakt v téže transakci jako `submission.update(submittedAt)`.
- `@unique(submissionId)` brání duplicitě i při souběhu (druhý `finish()` je beztak idempotentní +
  row lock `FOR UPDATE`, který už ve `finish()` je).
- Konzistenční job (součást backfillu, §5): najít `Submission` s `submittedAt != null` bez `SubmissionFact`
  a doplnit je.

---

## 5. Backfill plán

### 5.1 Které submissions brát
- `Submission` kde `submittedAt != null` a (`status ∈ {APPROVED, REJECTED}`) a **neexistuje** odpovídající `SubmissionFact`.
- Dávkově (např. po `organizationId`, stránkováno podle `createdAt`), idempotentně.

### 5.2 Jak řešit chybějící vazby
- `Student.id` nenalezen → `studentId = null`, `dataQuality = PARTIAL`.
- `Assignment`/`Test`/`TopicLevel` smazán nebo nedohledatelný → použít, co lze; chybějící povinné
  kontextové pole → `BROKEN_REFERENCE` (viz §6) a zapsat fakt s tím, co existuje (nikdy nepadat).
- `classSectionId` null a `Enrollment` nedohledatelný → `null` + `PARTIAL`.
- Body/skóre chybí (`earnedPoints`/`maxPoints` null, např. staré REJECTED) → `score=0/maxScore=0`,
  `percentage=0`, `dataQuality = LEGACY_INFERRED`.

### 5.3 dataQuality při backfillu
- Plný kontext z živých dat: `COMPLETE` (pozor: u backfillu je „historicky platný" jen přibližně —
  proto raději `LEGACY_INFERRED`, pokud nemáme jistotu, že se kontext od odevzdání nezměnil).
- **Doporučení:** backfillované fakty default `LEGACY_INFERRED`, `snapshotSource = BACKFILL`;
  jen tam, kde existuje per-response snapshot (`questionTextSnapshot` apod.), povýšit na `COMPLETE`.

### 5.4 Co dělat, když test/question už neexistuje
- Test smazán: použít `Submission.testId` (drží se i po `deletedAt`), `testVersion = null`-fallback
  nebo poslední známá; `dataQuality = LEGACY_INFERRED`.
- Question smazána, ale `Response` má `questionTextSnapshot` → použít snapshot.
- Question i snapshot chybí → `BROKEN_REFERENCE` pro daný `ResponseFact`, `SubmissionFact` se přesto vytvoří.

### 5.5 Logování nepodařených případů + fail-per-item
- **Fail per item (schváleno §10-Q2):** zpracování každé submission je v samostatném try/catch.
  Vadná položka → zaloguje se a přeskočí, **dávka pokračuje**. Backfill nikdy nepadá celý.
- Každý `BROKEN_REFERENCE`/`PARTIAL` → strukturovaný log (`logger.warn`) + souhrnná statistika dávky.
- `AuditLog` zápis na úrovni běhu jobu (`action: ANALYTICS_BACKFILL_RUN`, metadata: počty per dataQuality).
- Volitelně tabulka `analytics_backfill_log` (mimo nutné minimum) — nebo stačí `AuditLog`.

### 5.6 Bezpečné opakované spuštění
- Job je **idempotentní**: zpracovává jen submissions bez existujícího faktu (`skipDuplicates`).
- Stránkování + `--org=<id>` / `--limit=<n>` / `--dry-run` parametry.
- Žádné mazání existujících faktů. Re-run jen doplňuje chybějící.
- Spouštět jako CLI command (Nest standalone) nebo chráněný admin endpoint (SUPERADMIN).

---

## 6. Data quality

Enum `AnalyticsDataQuality` na `SubmissionFact` i `ResponseFact`:

| Stav | Kdy se použije |
|---|---|
| `COMPLETE` | Snapshot vznikl **při finish()** z živého kontextu, všechny povinné vazby (membership, test, year) dohledány. Per-response snapshoty existují. |
| `PARTIAL` | Fakt vznikl, ale **chybí nepovinná kotva/kontext**: `Student.id` nenalezen, `classSectionId` nedohledatelný, `subjectId/topicLevelId` null. Data jsou použitelná, ale s mezerou. |
| `LEGACY_INFERRED` | **Backfill** z historických dat, kde kontext mohl být zpětně změněn (čteno živě, ne v čase odevzdání). Důvěra nižší — UI ukáže disclaimer. |
| `BROKEN_REFERENCE` | Klíčová vazba **nedohledatelná** (smazaná otázka bez snapshotu, chybějící test bez fallbacku). Fakt se vytvoří kvůli úplnosti počtů, ale **vyloučí se z mastery/detailních pohledů**. |

Pravidlo: `dataQuality` se v běžném provozu **jen zhoršuje při vzniku**; zlepšit (`→ COMPLETE`)
smí pouze cílený opravný backfill.

**Vynucení ochrany `givenTextSnapshot` (§10-Q3):** read vrstva musí mít dva oddělené přístupy —
(a) **agregované/seznámové** dotazy (timeline, mastery, class/org rollupy) `givenTextSnapshot`
**nikdy neselectují**; (b) **per-otázkový detail** (oprávněná role + audit) ho selectovat smí.
Doporučení: zapouzdřit do dvou Prisma `select` profilů, aby se osobní text nedal omylem prosáknout
do agregací.

---

## 7. Testovací plán (backend)

Konkrétní testy (unit + e2e), které musí existovat před označením Fáze 2 za hotovou:

1. **Snapshot vznikne po submitu** — `finish()` vytvoří 1 `SubmissionFact` + N `ResponseFact`
   se správnými body/percentage/counts. *(e2e)*
2. **Žádná duplicita při opakovaném submitu** — druhé volání `finish()` (idempotentní) **nevytvoří**
   druhý fact; `@unique(submissionId)` drží. *(e2e)*
3. **Editace otázky/testu po submitu nezmění fakt** — po `finish()` změnit `Question.text`/`correctAnswer`
   a `Test.version`; `SubmissionFact`/`ResponseFact` zůstanou beze změny (rozšíření existujícího
   `test-flow-hardening` case G). *(e2e)*
4. **Snapshot drží academicYear + classSection z doby odevzdání** — po submitu změnit
   `Assignment`/`Enrollment`; fakt drží původní `academicYearId`/`classSectionId`. *(e2e)*
5. **Resolve `Student.id` z `membershipId`** — fakt má `studentId = Student.id`; varianta bez
   `Student` řádku → `studentId=null`, `dataQuality=PARTIAL`. *(unit + e2e)*
6. **Backfill je idempotentní** — dvojí běh nezdvojí fakty; doplní jen chybějící. *(e2e)*
7. **Broken reference ≠ pád dávky** — submission se smazanou otázkou bez snapshotu → `ResponseFact`
   označen `BROKEN_REFERENCE`, dávka pokračuje, ostatní fakty vzniknou. *(e2e)*
8. **Tenant izolace** — fakty nesou správný `organizationId`; cross-org dotaz je nevidí. *(e2e)*
9. **Transakční atomicita** — vynucená chyba při zápisu faktu → rollback `finish()`, submission
   zůstane neuzavřená (žádný „APPROVED bez faktu"). *(unit s mockem)*
10. **Žádný `isBestAttempt` na faktu** — „nejlepší pokus" se počítá on-demand z `[membershipId, testId]`;
    `SubmissionFact` zůstává immutable (regresní kontrola, že pole neexistuje). *(unit)*

---

## 8. Co zatím NEimplementovat (mimo Fázi 2)

- ❌ Žádný velký dashboard / vizualizace (Fáze 3+).
- ❌ Žádný parent view (vyžaduje `GuardianLink` — Fáze 5).
- ❌ Žádné AI recommendations.
- ❌ Žádné predikce/odhady známek.
- ❌ Žádný cross-school benchmarking.
- ❌ Žádný složitý mastery model (`StudentTopicMastery`, recency decay — Fáze 6).
- ❌ Žádný globální refactor identity (`membershipId → Student.id/userId` napříč codebase) —
  Fáze 2 jen **snapshotuje** kotvu; refactor čtecích cest je samostatný plán.
- ❌ Žádné nové read `/analytics` endpointy nad facty (přijdou až po ověření zápisu/backfillu).
- ❌ Žádný per-question timing (`responseTimeSec` zůstává `null`).

---

## 9. Doporučené pořadí implementace (checklist)

1. **Prisma modely** — `SubmissionFact`, `ResponseFact`, enumy `AnalyticsDataQuality`,
   `AnalyticsSnapshotSource`; relace + indexy. *(schválit §10 nejdřív)*
2. **Migrace** — nové tabulky + indexy (aditivní, žádná změna existujících).
3. **Analytics snapshot service** — `AnalyticsFactService` (nebo do `analytics` modulu):
   čistá funkce „ze submission + kontextu sestav fakty", plně testovatelná bez DB.
4. **Integrace do `finish()`** — volání service uvnitř existující `$transaction`; defenzivní
   resolve kontextu + identity; `dataQuality` výpočet.
5. **Backfill command/job** — idempotentní CLI (Nest standalone), `--org/--limit/--dry-run`,
   logging + `AuditLog`.
6. **Testy** — všech 10 bodů §7 (unit + e2e).
7. **Dokumentace** — aktualizovat tento dokument o reálné názvy/rozhodnutí + `MEMORY.md` pointer.
8. **(Až potom) první read endpointy** — `GET /analytics/students/:id/timeline` nad facty
   (uvolnění cross-year), s `dataQuality` v payloadu. *(už hraničí s Fází 3)*

---

## 10. Shrnutí, rizika a místa, kde potřebuji tvoje rozhodnutí

### Shrnutí
- Potvrzeno: `Submission.studentId` = **`membershipId`** (FK na `Membership`), všude v kódu.
- `Student.id` lze bezpečně dohledat přes unikátní `Student.membershipId`; když chybí → `PARTIAL`, nikdy nefailovat.
- Plán snapshotuje **oba** identifikátory (+ volitelně `userId`), s historicky platným kontextem
  (rok, třída, předmět, téma, verze testu) a `dataQuality` stavem.
- Snapshot vzniká **v transakci `finish()`** (fail-closed), backfill řeší historii idempotentně.
- Fáze 2 = jen zápis + backfill + testy; žádné dashboardy, žádný mastery, žádný refactor identity.

### Rizika
1. **Fail-closed v transakci** může teoreticky zablokovat odevzdání, pokud snapshot vyhodí neočekávanou
   chybu → mitigace: defenzivní kód (chybějící data = `PARTIAL`, ne exception).
2. **`Student.id` nemusí být stabilní přes re-enrollment**, pokud onboarding tvoří nový `Student` řádek
   → skutečná kontinuita až přes `userId`. Bez rozhodnutí Q1 hrozí, že „stabilní kotva" stabilní nebude.
3. **Backfill `COMPLETE` vs. `LEGACY_INFERRED`** — u historie nevíme, zda se kontext nezměnil; konzervativně
   `LEGACY_INFERRED`, jinak riskujeme falešně „pravdivá" historická data.
4. **GDPR u `givenTextSnapshot`** — duplikace odpovědí žáka do další tabulky zvyšuje retenční povrch.
5. **Difficulty fallback** — bez obtížnosti na otázce je rozpad jen přibližný; nesmí se prezentovat jako přesný.
6. **Objem dat** — facts rostou lineárně se submissions; indexy navrženy, ale je třeba sledovat velikost
   `ResponseFact` (řádek per odpověď).

### Rozhodnutí — SCHVÁLENO (2026-06-16)
Všech 6 otázek vyřešeno; plán výše je podle nich aktualizovaný.

| # | Rozhodnutí | Důsledek v plánu |
|---|---|---|
| **Q1 — Kotva identity** | Přidat `userId` (required) **navíc** k `membershipId` a `studentId`. Každý řeší jiný problém. | §1.6, §2.1 (`userId` required, index `[userId, submittedAt]`) |
| **Q2 — Selhání snapshotu** | **Fail-closed** pro nové submity (chyba = rollback submitu). Backfill **fail per item** + log. | §4.4, §5.5 |
| **Q3 — `givenTextSnapshot`** | **Ukládat**, ale s retenční/anonymizační politikou; **nepouštět do agregovaných view** (jen per-otázkový detail s auditem). | §2.2, §6 |
| **Q4 — Backfill dataQuality** | Default **`LEGACY_INFERRED`** (historii nevydáváme za 100% přesnou). | §5.3 |
| **Q5 — Názvy modelů** | **`SubmissionFact` / `ResponseFact`** (modely takto; služby/třídy mohou žít v `AnalyticsModule`). | §2, §9 |
| **Q6 — Backfill** | **CLI command** (Nest standalone). Žádný SUPERADMIN endpoint — je to provozní/migrační operace. | §5.6, §9 |

**Otevřené (ne-blokující) k pozdějšímu doladění:**
- Přesná **retenční doba** `givenTextSnapshot` a raw odpovědí po odchodu žáka — doladit s DPO (mimo Fázi 2).
- Reálný `startedAt`/`responseTimeSec` — vědomě odloženo (zůstává proxy `createdAt` / `null`).
```
