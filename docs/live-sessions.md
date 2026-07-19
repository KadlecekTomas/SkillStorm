# Bleskovky (Live Sessions)

Živá cvičení pro celou třídu na interaktivní tabuli. MVP je **režim B
(`BOARD_ONLY`)**: vše běží na učitelově obrazovce, žáci odpovídají ve třídě
nahlas/hlasováním a učitel zadává výsledek kola. Datový model a API jsou od
prvního dne připravené na **režim A (`DEVICES`)** — žáci se připojí vlastními
zařízeními přes kód (realtime, WebSockets). Režim A je **záměrně
neimplementovaný**; tento dokument popisuje, kde jsou pro něj švy.

## Datový model

- `LiveSession` — běh bleskovky: `hostId` (Membership učitele),
  `organizationId`, volitelně `classSectionId` (kvůli třídnímu parťákovi),
  `testId` (zdrojová sada = existující `Test`), `mode`, `status`, `ageMode`,
  `countdownSec`.
- `LiveSessionRound` — jedno kolo se **snapshotem otázky** (text, možnosti
  A–D, správný klíč). Pozdější editace zdrojového testu běžící ani ukončenou
  bleskovku neovlivní. `outcome` je soud kola — buď ruční (3 tlačítka), nebo
  předvyplněný z hlasování (viz níže); učitelovo slovo je vždy finální.
  `voteCounts` (`Json?`) jsou **anonymní agregáty hlasů z dotykové tabule**
  (`{"A": 14, "B": 6}`), `votingStartedAt` označuje otevřenou fázi VOTING.
- `LiveSessionParticipant` — **navrženo pro režim A, v režimu B se nikdy
  nezapisuje** (viz GDPR níže).
- `ClassPartak` + `ClassPartakXpEvent` — kolektivní parťák třídy.

### Sada otázek = `Test`

Bleskovka není nový typ obsahu. `Question` má povinnou vazbu na `Test` a celý
builder nad ní stojí, takže „sada" je publikovaný test. Do kol se snapshotují
jen kompatibilní otázky: `MULTIPLE_CHOICE` v single-módu (2–4 možnosti, právě
jedna správná) a `TRUE_FALSE` (→ Pravda/Nepravda). `FILL_IN_THE_BLANK` a
multi-select se přeskakují. Budoucí globální knihovna sad = samostatný krok
(dnes jsou seedové sady org-scoped testy v demo organizaci).

## Stavový automat

```
DRAFT ──POST :id/start──▶ RUNNING ──POST :id/finish──▶ FINISHED
```

- `start` snapshotuje kola v transakci; `updateMany` guard (stejný vzor jako
  publish testu) drží idempotenci při souběhu.
- `finish` atomicky přepne stav a připíše XP; druhé volání → 409.

### Fáze kola (hlasování je volitelné)

```
otázka ──[Hlasujeme!]──▶ VOTING ──[Odhalit]──▶ REVEAL (graf + auto-outcome)
   └──[Přeskočit hlasování]──▶ REVEAL (ruční outcome, 3 tlačítka)
```

- `POST :id/rounds/:roundId/voting` otevře fázi VOTING (idempotentní; po
  revealu → 409 `ROUND_ALREADY_REVEALED`).
- `POST :id/rounds/:roundId/votes` (`{key, delta: 1 | -1}`) inkrementuje
  agregát — atomicky v SQL, klampované na 0. Přijímá se **pouze** ve fázi
  VOTING, jinak 409 `ROUND_NOT_VOTING`. Odpověď nikdy neobsahuje správný klíč.
- `reveal` u kola s hlasy spočítá **auto-outcome**: podíl hlasů pro správnou
  odpověď ≥ 2/3 → `MOSTLY_CORRECT`, ≤ 1/3 → `MOSTLY_WRONG`, jinak `SPLIT`
  (prahy = konstanty `VOTE_CORRECT_MIN_SHARE` / `VOTE_WRONG_MAX_SHARE`,
  celočíselné srovnání — žádné floaty). Auto-outcome se rovnou persistuje
  (kolo je odehrané); učitel ho může jedním klepnutím přepsat přes stávající
  `outcome` endpoint — jeho slovo je finální.
- **Hlasy nikdy nevstupují do XP, kampaní ani advance** — `finish` počítá jen
  `completedAt`-kola, stejně jako dřív (kryto e2e testem: opačné poměry hlasů
  → identická XP delta).

## Bezpečnostní kontrakt projekce (platí i pro režim A)

**`correctKeySnapshot` nikdy neopouští server před revealem.** Projekce běží
na sdíleném/školním zařízení — network tab nesmí prozradit odpovědi budoucích
kol. `GET /live-sessions/:id` vrací kola bez správného klíče;
`POST :id/rounds/:roundId/reveal` uloží `revealedAt` a klíč vrátí. Po revealu
už projekční GET klíč u daného kola obsahuje (kvůli refreshi uprostřed hodiny).
V režimu A bude tentýž kontrakt platit pro websocket eventy: klientům se
otázka pošle bez správné odpovědi, reveal je samostatný event.

RBAC: všechny endpointy jsou TEACHER+ (`CREATE_TEST`) a **host-only** — cizí
organizace dostane 404 (existence se neprozrazuje), jiný učitel téže
organizace 403. Projekce nevyžaduje žádné žákovské přihlášení, protože ji
obsluhuje přihlášený učitel; žádná veřejná URL v režimu B neexistuje.

## GDPR: proč režim B nezapisuje nic o dětech

Režim B je **anonymní na úrovni třídy** — záměr, ne nedodělek. Ukládá se jen
agregovaný soud za kolo (`MOSTLY_CORRECT | SPLIT | MOSTLY_WRONG`) a volitelné
**anonymní agregáty hlasů** (`voteCounts`, `{"A": 14, "B": 6}`) — děti chodí
hlasovat k jedné sdílené tabuli, takže neexistuje žádná cesta, jak hlas
spojit s osobou, a nic takového se ani neukládá. Hlasy slouží výhradně
učitelovu přehledu; do XP ani odměn nevstupují. Žádné per-žák odpovědi,
žádná identifikace dětí. Tabulka
`LiveSessionParticipant` existuje jen jako schéma pro režim A; v režimu B do
ní nevede žádná cesta kódu. Až režim A vznikne, `nickname` je přezdívka (ne
jméno) a `membershipId` se vyplní jen u autentizovaného joinu.

## Třídní parťák (ClassPartak)

- XP **pouze** za odehraná kola (`ROUND_PLAYED`, 10 XP/kolo) a dokončené
  bleskovky (`SESSION_FINISHED`, 50 XP). Vynuceno konstrukcí: enum
  `ClassPartakXpType` jiné zdroje nemá a `finish()` počítá jen
  `completedAt`-kola; `outcome` do výpočtu nevstupuje (kryto e2e testem D).
- Stage je lineární: `stage = 1 + floor(xp / 300)`.
- **Žádné srovnávání tříd** v UI ani API (ani v ředitelské analytice) —
  neexistuje list/ranking endpoint, jen `GET /live-sessions/class-partak/:id`
  pro vlastní třídu. Stejné pravidlo jako u individuálního parťáka.

## Věkové režimy projekce (`LiveAgeMode`)

| Režim | Ročníky | Projekce |
|---|---|---|
| `YOUNG` | 1.–3. ZŠ | velké dlaždice, ikony, Parťák-blob komentuje, bez odpočtu defaultně |
| `MIDDLE` | 4.–9. ZŠ | kompaktnější, odpočet zapnutý, parťák střízlivější |
| `SENIOR` | SŠ (`HIGH_SCHOOL_YEAR_*`) | „quiz night" — jen emblém, tmavší tón, tempo + streak |

Default se odvozuje z `classSection.grade`; učitel může před spuštěním ručně
přepnout (smíšené skupiny, semináře). **Fallback při neznámém ročníku je
`MIDDLE`** — jiná volba než u testového `resolveAnsweringMode` (fallback
`old`): test je vysokorizikový kontext, kde je bezpečnější selhat do plného
režimu s časovačem a kontrolou; projekce bleskovky je nízkoriziková
prezentační vrstva, kde je střední úroveň nejuniverzálnější a nic nerozbije.

## Švy pro režim A (kde se bude řezat)

1. **Participant tabulka** — `LiveSessionParticipant` už existuje ve schématu
   (join přes `joinToken`, reconnect přes `lastSeenAt`).
2. **Lobby** — mezi `create` (DRAFT) a `start` (RUNNING) je dnes z pohledu
   učitele jeden klik; v režimu A se sem vklíní lobby s join kódem. Stavový
   automat se rozšíří jen o čekání v DRAFT, žádná migrace stavů.
3. **Event flow kol** — dnes je zdrojem pravdy `GET` projekce + POST reveal/
   outcome; v režimu A se tytéž přechody (round-open, reveal, round-closed)
   publikují jako WS eventy (gateway vedle stávajícího SSE `EventsService`).
   Reveal kontrakt (klíč až po revealu) zůstává.
4. **Per-žák odpovědi** — přibude tabulka odpovědí vázaná na participanta;
   `outcome` pak může být spočítaný návrh místo ručního soudu. XP pravidla
   parťáka se NEMĚNÍ (žádné XP za správnost ani v režimu A).
5. **`mode`** — `DEVICES` v enumu existuje; controller ho zatím nikdy
   nenastaví.

## Co režim B záměrně nemá

Žádné WebSockets, žádný join flow, žádné per-žák odpovědi, žádné žebříčky.

## Seed

`npm run seed:live-sessions` (v `server/`) — 3 publikované ukázkové sady
v demo organizaci: Vyjmenovaná slova (3. ZŠ), Zlomky (7. ZŠ), Literatura
20. století (SŠ). Idempotentní.
