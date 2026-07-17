# Kampaně — Výprava & Mise (meziherní vrstva nad Bleskovkami)

Kampaň je **téma + meziherní stav NAD existujícím LiveSession enginem**.
Stavový automat session (DRAFT→RUNNING→FINISHED), kola, reveal, outcome ani
XP logika se **nemění** — jediný zásah do stávajících tabulek je nullable
`live_sessions.campaign_progress_id`.

## Neporušitelná pravidla (vynucená kódem + testy)

| Pravidlo | Kde je vynuceno |
| --- | --- |
| Postup POUZE za dokončené bleskovky s ≥ 1 odehraným kolem | `CampaignsService.advanceWithinTransaction` (guard `roundsPlayed < 1`) |
| Správnost NIKDY neovlivňuje postup | advance čte jen `completedAt` kol; e2e C + PW scénář (opačné outcomes → identický postup) |
| Správnost smí měnit jen kosmetiku | `MissionSignalMeter` — hodnota z kol, outcome jen glow/šum efekt |
| Žádné srovnávání tříd | žádný list/ranking endpoint; board zná jen jeden `progressId` |
| `correctKey` neopouští server před revealem | campaign endpointy s koly vůbec nepracují; PW scénář to ověřuje i v kampaňové session |
| Vzkaz minulé třídy až po explicitním revealu učitele | detail ho nevrací bez `predecessorMessageRevealedAt`; preview je teacher-only endpoint (e2e G) |

## Architektura

### Obsah = data, ne kód

Definice kampaní žijí v **`server/content/campaigns/*.json`**. Žádná DB
tabulka `Campaign` neexistuje — `CampaignContentService` načte soubory při
bootu, zvaliduje zod schématem (`campaign-content.schema.ts`) a při chybě
**spadne** (fail-fast). Cesta se řeší pro dev (`cwd`) i dist boot
(`__dirname/../..`) — viz CI past z PR #13.

### DB modely (jen meziherní stav)

- **`CampaignProgress`** — rozehraná kampaň jedné třídy:
  `[classSectionId, campaignId]` unique (třída může mít víc kampaní),
  `position` (počet dokončených kroků), `totalSteps` + `campaignType`
  (snapshot z obsahu), `status` ACTIVE/COMPLETED, epilogue pole a
  `predecessorProgressId` + `predecessorMessageRevealedAt` (vzkaz minulé
  třídy, reveal pojistka).
- **`CampaignStepUnlock`** — 1 řádek = 1 odemčená zastávka/kapitola.
  Zároveň JE sbírkou samolepek (Výprava) i nástěnkou fragmentů (Mise) —
  assety se dohledávají v JSON podle `stepKey`. `sessionId @unique` je
  idempotenční kotva (jedna session ⇒ max 1 krok),
  `[progressId, stepIndex]` unique serializuje souběh.

### Advance

Běží **uvnitř stávající finish transakce** (`LiveSessionsService.finish`),
atomicky se session XP:

1. `updateMany where status=RUNNING` guard (existující) — finish proběhne jednou,
2. `SELECT … FOR UPDATE` na progress řádku — souběžné finishe téže třídy se serializují,
3. `roundsPlayed ≥ 1` → vznikne unlock + `position += 1`; poslední krok
   nastaví `COMPLETED`. Ukončení v půlce kol postup NEBLOKUJE (odehraná
   kola se snapshotují na unlock — decisions R3).

Finish response nese `campaignAdvance` (stepIndex/stepKey/position/status)
pro animaci na projekci.

### RBAC

Všechny campaign endpointy `@Permission(CREATE_TEST)` (TEACHER+). Service
navíc vynucuje: třída v cizí org → 404; učitel bez vztahu ke třídě
(homeroom NEBO platný `TeacherClassSection`) → 403; DIRECTOR/OWNER celá org.

### Endpointy

| Endpoint | Účel |
| --- | --- |
| `GET /campaigns?classSectionId=` | dostupné kampaně dle ročníku třídy (`targetGrades`) |
| `GET /campaigns/progress?classSectionId=` | rozehrané kampaně třídy |
| `POST /campaigns/progress` | rozehrát kampaň (snapshot totalSteps + predecessora) |
| `GET /campaigns/progress/:id` | detail pro mapu/nástěnku — odemčené kroky plně, další jen silueta (key/title), budoucí nic |
| `POST /campaigns/progress/:id/epilogue` | vzkaz budoucí třídě (Mise, po dokončení) |
| `GET /campaigns/progress/:id/predecessor-message` | náhled vzkazu — JEN učitel, reveal neprovádí |
| `POST /campaigns/progress/:id/predecessor-message/reveal` | explicitní potvrzení — od té chvíle je vzkaz v detailu |

### Klient

- `client/src/lib/api/campaigns.ts` — typy + API.
- Setup dialog Bleskovky: volitelný select kampaně (pokračovat / začít novou).
- `live-board.tsx`: Výprava = intro mapa („kam dnes jdeme") + segment strip
  (parťák poposkočí za každé kolo) + finish scéna (zastávka, samolepka,
  háček + silueta). Mise = tmavé plátno (senior tón vynucen i mimo senior
  ageMode), signál metr, finish scéna (fragment, cliffhanger, POKRAČOVÁNÍ
  PŘÍŠTĚ).
- `/app/campaigns/[progressId]/board` (focus group) — kampaňová projekce
  kdykoli: Výprava = mapa + třídní sbírka samolepek; Mise = nástěnka
  fragmentů + epilogue formulář + reveal pojistka vzkazu.
- Komponenty v `client/src/components/campaigns/`.

## Jak přidat další kampaň (čistý JSON, žádný kód)

1. Vytvoř `server/content/campaigns/<slug>.json`:

```jsonc
{
  "id": "muj-slug",                 // [a-z0-9-], stabilní navždy (odkazuje na něj DB)
  "version": 1,
  "type": "EXPEDITION",             // nebo "MISSION"
  "title": "Název",
  "subtitle": "Podtitulek (volitelný)",
  "reviewStatus": "draft",          // "approved" až po redakci
  "targetGrades": { "min": "GRADE_1", "max": "GRADE_5" },
  "intro": "Úvodní text pro učitele/projekci.",
  // MISSION navíc: "epilogue": { "enabled": true, "prompt": "…" },
  "steps": [
    // EXPEDITION krok:
    { "key": "zastavka-1", "title": "…", "scene": "…", "hook": "…",
      "sticker": { "key": "…", "name": "…", "emoji": "⭐" } }
    // MISSION krok:
    // { "key": "kapitola-1", "title": "…", "scene": "…",
    //   "fragment": { "kind": "text", "title": "…", "body": "…" },
    //   "cliffhanger": "…" }
  ]
}
```

2. Restartuj server — obsah se validuje při bootu (chybný soubor = pád se
   srozumitelnou chybou). Nic dalšího: žádná migrace, žádný seed.
3. Mapa Výpravy je generická (S-křivka se počítá parametricky), funguje pro
   2–16 zastávek.

Pozor: **neměň `id` ani pořadí/`key` kroků u kampaně, kterou už nějaká třída
hraje** — unlock řádky nesou `stepIndex` + snapshot `stepKey`; obsahový
drift se pozná, ale nevrací se zpětně.

## Vlastní IP

Příběhy („Cesta za světluškou", „Archiv") i estetika jsou vlastní tvorba —
inspirace žánrem (kooperativní putování / seriálová záhada časové schránky),
žádná jména ani motivy z existujících děl.

## Testy

- `server/test/e2e/campaigns.e2e-spec.ts` — 7 testů: list dle ročníku,
  advance + idempotence + XP vzorec, opačné outcomes → identický postup,
  finish v půlce kol (≥1 kolo ano / 0 kol ne), vazba session↔kampaň,
  RBAC (student/cizí org/bez úvazku/ředitel), Mise (dokončení, epilogue,
  reveal pojistka).
- `client/tests/scenarios/campaigns.scenario.ts` — 2 scénáře (Výprava,
  Mise) end-to-end přes UI, viz hlavičku souboru.
