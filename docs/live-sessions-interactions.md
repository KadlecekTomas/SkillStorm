# Bleskovky — interaktivní kola (drag & drop na tabuli)

Bleskovka umí kromě kvízových kol (A/B/C/D, pravda/nepravda, hlasování)
i kola řešená přímo dotykem na interaktivní tabuli:

| `RoundInteractionType` | Plocha | Řešení |
| --- | --- | --- |
| `QUIZ` | dlaždice / hlasování | reveal učitelem |
| `MATCH_PAIRS` | dva sloupce, 4–6 dvojic, táhni a spoj | server soudí každé položení |
| `ORDER` | 4–6 kartiček ve vodorovné řadě, tlačítko **Zkontrolovat** | server vrací masku po pozicích |
| `SORT_BINS` | 2–3 koše, 6–10 kartiček | server soudí každé položení |

## Principy (neporušovat)

1. **Řešení nikdy neopouští server před dokončením kola.** Board dostává
   `contentSnapshot` (zamíchaný obsah bez mapování), řešení žije
   v `solutionSnapshot` a ven jde až s `completedAt`/`revealedAt`. Stejný
   kontrakt jako `correctKeySnapshot` u kvízu — network tab na sdíleném
   zařízení nesmí nic prozradit.
2. **Round-local ID.** Při snapshotu ve `start()` se autorská ID položek
   překlíčují na pozice po zamíchání (`l1/r1`, `o1`, `c1/b1`). Autorská ID
   ze seedů (`i1`…`i5` v pořadí řešení) by jinak řešení prozradila.
3. **Snapshot je imunní** vůči pozdější editaci otázky — platí beze změny.
4. **Iterace, ne verdikt.** Špatné položení = zatřesení a návrat (žádná
   červená hanba); správné = pop + usazení. Server počítá anonymní agregát
   `attemptStats` (`wrong`, `placed`, `checks`) — žádná vazba na osoby.
5. **XP jen za odehrání.** Pokusy ani outcome do XP/kampaní nikdy
   nevstupují (e2e invariant: katastrofální vs. bezchybné řešení →
   identická delta).
6. **Latence školní wifi.** Každý tah je samostatný POST; kartička po
   puštění zůstává usazená s jemným pulzem (`pending`), dokud server
   nerozhodne. Tahy se nefrontují — souběžné pending kartičky jsou
   normální stav.
7. **Auto-outcome z průběhu**: prahy v `live-sessions.constants.ts`
   (`computeAttemptOutcome`): `wrong ≤ ⌈items/3⌉` → MOSTLY_CORRECT,
   `≤ items` → SPLIT, jinak MOSTLY_WRONG. Učitel může přepsat
   (`setOutcome`), jeho slovo je finální.

## Mapa kódu

**Server**
- `prisma/schema.prisma` — `RoundInteractionType`, `Question.content`,
  `LiveSessionRound.{interactionType,contentSnapshot,solutionSnapshot,attemptStats}`
- `src/shared/interactive-content.util.ts` — tvary + validace autorského
  obsahu (`Question.content`), limity `INTERACTIVE_LIMITS`
- `src/shared/test-assignability.util.ts` — `isPublishable` (validní
  interaktivní otázky publish nepustí ke dnu) vs. `isAssignable`
  (interaktivní otázka vždy blokuje zadání testu žákům)
- `src/live-sessions/interactive-rounds.util.ts` — board-safe snapshot +
  řešení + překlíčování ID
- `src/live-sessions/live-sessions.service.ts` — `submitAttempt()`
  (PLACE/CHECK, atomické jsonb inkrementy, dokončení přes `updateMany`
  s `completed_at IS NULL`), `revealInteractive()` („Ukázat řešení")
- `src/live-sessions/dto/submit-attempt.dto.ts` — kontrakt tahu

**Klient**
- `src/components/live-sessions/touch-dnd.tsx` — sdílený dotykový DnD
  engine (pointer events, ghost, drop zóny, stavy kartiček)
- `src/components/live-sessions/interactive-rounds.tsx` —
  `useInteractiveRound` (pending/wrong/placed stavy, neblokující tahy) +
  plochy tří typů + oslava
- `src/components/live-sessions/live-board.tsx` — integrace, ovládací
  pruh (targety 80 px+), fullscreen toggle
- `src/components/tests/interactive-content-editor.tsx` — builder editor
  dvojic/pořadí/košů

**Testy**
- `server/test/e2e/board-interactions.e2e-spec.ts` — outcome prahy, XP
  invariant, snapshot/leak guardy, RBAC, publish/assign šev
- `client/tests/scenarios/board-interactions.scenario.ts` — touch drag
  (syntetické PointerEventy s `pointerType: 'touch'`), throttle 400 ms
  (pending pulz, nefrontování), ovládací pruh

## Jak přidat další interactionType (šev)

Budoucí kandidáti: doplňovačky (slovo do mezery), hotspot na obrázku,
spojovačky přes čáru. Checklist:

1. **Schéma**: přidej hodnotu do `QuestionType` i `RoundInteractionType`
   (migrace `ALTER TYPE … ADD VALUE`). Autorská data jdou do
   `Question.content` — nový sloupec není potřeba.
2. **Validace obsahu**: rozšiř `interactive-content.util.ts` — typ
   obsahu, limity, `validateInteractiveContent` větev, přidej typ do
   `INTERACTIVE_QUESTION_TYPES` (tím se automaticky chytí assignability
   guard, DTO validator odpovědí i publish gate).
3. **Snapshot**: větev v `buildInteractiveSnapshot()` — board-safe obsah
   s round-local ID + řešení. Nezapomeň na zamíchání a na to, že se
   zobrazené pořadí nesmí trefit do řešení.
4. **Vyhodnocení**: rozšiř `submitAttempt()` — buď stávající kind `PLACE`
   (má-li typ položku→cíl sémantiku, stačí větev v `validItemIds`/
   `validTargetIds` + mapování v řešení), nebo `CHECK` (jednorázová
   kontrola celku), případně nový kind v `SubmitAttemptDto`.
   `attemptStats`/`computeAttemptOutcome` jsou typově agnostické — udrž
   sémantiku „wrong = špatný pokus, itemCount = počet položek".
5. **Klient**: typ v `lib/api/live-sessions.ts`, board komponenta
   v `interactive-rounds.tsx` (postav ji z `TouchDndBoard`/`DragCard`/
   `DropZone` — pending/wrong/settled stavy dostaneš zadarmo),
   builder editor v `interactive-content-editor.tsx`.
6. **Obsah + testy**: seedy (`live-sessions.seed.ts`, `showcase.seed.ts`,
   `scenarios-e2e.seed.ts`), e2e větev outcome prahů + XP invariant,
   Playwright touch scénář, portfolio záběr.

## Publish vs. zadání žákům

Sada s interaktivními otázkami jde **publikovat** (bleskovka vyžaduje
`PUBLISHED`), ale **nejde zadat žákům** jako klasický test —
`INTERACTIVE_ONLY_QUESTION` blokuje `isAssignable`, nevalidní obsah
(`INVALID_INTERACTIVE_CONTENT`) blokuje i publish. UI to hlásí
v TestHealthPanel.
