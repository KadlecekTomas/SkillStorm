# Kampaně — rozhodnutí mimo plán (noční log)

Formát: každé rozhodnutí má možnosti, výběr a důvod. Ráno projít.

## R7 — Oprava wipe scénářového seedu (pre-existing, odhaleno kampaněmi)

`scenarios-e2e.seed.ts` wipe nemazal live sessions; `LiveSession→Test` je
RESTRICT, takže `test.deleteMany` padal při KAŽDÉM druhém lokálním běhu
scénářů (poprvé to odhalil kampaňový scénář — bleskovkové scénáře běžely
dosud vždy nad čerstvou DB). Doplněny delete pro campaign_step_unlocks,
campaign_progresses, class_partak_xp_events, class_partaks, live_sessions
(před tests). CI to nevidělo, protože tam se DB zakládá vždy čistá.

## Otevřené otázky pro Tomáše (ráno)

1. **Obsah je draft** — texty Výpravy (7–9 let) i Archivu projít; zejména
   tón K3 a epilogue prompt.
2. **K1 fragment „datum z příštího týdne"** — teď literál („zápis
   z pondělí — příští týden"). Chceme šablonovou proměnnou s reálným datem
   (např. `{{nextMonday}}` doplněné na serveru)? Rozhodl jsem se ji zatím
   nezavádět (obsah = statická data).
3. **Vstup na kampaňovou projekci** — board je zatím dosažitelný jen přes
   setup dialog (po bleskovce) a přímou URL. Přidat kartu „Kampaně" na
   dashboard učitele / detail třídy?
4. **Učitel s více homerooms**: `getMyStructure` vrací jen PRVNÍ homeroom
   (bucket), další třídy bez úvazku ve struktuře nejsou → dialog Bleskovky
   je nenabídne. Obešel jsem to v seedech úvazkem (TeacherClassSection),
   ale je to kandidát na samostatnou opravu.
5. **„Hrát znovu"** — dokončená kampaň se pro tutéž třídu nedá restartovat
   (unique [classSectionId, campaignId]). Příští školní rok je to nová
   ClassSection, takže tam problém není. OK?
6. **Vzkaz předchůdce se snapshotuje při STARTU kampaně** — třída, která
   začala dřív, než předchůdce vzkaz nahrál, ho nikdy nedostane. Přijatelné
   (jednodušší, deterministické), nebo dohledávat i později?
7. **Epilogue jen u Mise** — Výprava vzkaz budoucí třídě nemá (záměr:
   smyčka patří k příběhu Archivu). Chceme obdobu i pro Výpravu?

## R1 — Campaign není DB tabulka, ale soubor v content registry

**Možnosti:**
- (a) DB model `Campaign` seedovaný/synchronizovaný z JSON souborů
- (b) Žádná DB tabulka — `content/campaigns/*.json` je jediný zdroj pravdy,
  server je načte při bootu (zod validace, fail-fast), `CampaignProgress.campaignId`
  je slug z JSON

**Výběr: (b).** „Přidat kampaň = přidat JSON" platí doslova — žádná migrace,
žádný seed, žádná synchronizační logika, obsah je PR-reviewovatelný diff.
Referenční integrita se řeší validací proti registru v service vrstvě
(neexistující slug → 404 při startu kampaně; progress s odstraněným obsahem
se zobrazí jako „archivní" místo pádu).

**Dopad:** JSON musí být dostupný i při bootu z `dist` (CI past z PR #13) —
soubory jdou do `server/content/campaigns/` a `nest-cli.json` je kopíruje
jako asset do dist.

## R2 — Sbírka samolepek/fragmentů = tabulka odemčení kroků, ne nový model

**Možnosti:**
- (a) Nový model `StickerCollection`
- (b) Pole (JSON array) na `CampaignProgress`
- (c) Tabulka `CampaignStepUnlock` (1 řádek = 1 odemčená zastávka/kapitola)
  — samolepka i fragment jsou jen obsahová interpretace odemčeného kroku,
  assety žijí v campaign JSON pod klíčem kroku

**Výběr: (c).** Jedna tabulka pokrývá oba formáty (Výprava: samolepka,
Mise: fragment), nese `unlockedAt` timestampy, které zadání chce, a unikátní
constrainty na ní jsou zároveň idempotenční kotva advance (viz R4).
Sbírka je třídní (vazba přes progress → classSection), ne individuální —
o dětech se neukládá nic, stejně jako v režimu B.

## R3 — Ukončení bleskovky v půlce kol

**Možnosti:**
- (a) Zastávka se počítá jen při odehrání všech kol
- (b) Zastávka se počítá při finish bez podmínek (i 0 kol)
- (c) Zastávka se počítá při finish, pokud proběhlo ≥ 1 dokončené kolo

**Výběr: (c).** Důvody:
- Měnou postupu je účast, ne výdrž — hodina může skončit dřív (zvonění,
  požární poplach) a třída nesmí o dnešní krok přijít. Varianta (a) by
  tlačila učitele dojíždět kola pod tlakem — proti duchu vertikály.
- Odehraná kola se neztrácejí: `roundsPlayed` se snapshotuje na unlock
  záznam (rekapitulace + kosmetika „síly signálu" v Misi).
- Podmínka ≥ 1 kola blokuje prázdný spam (start + okamžitý finish bez
  hraní) — to není trest za správnost, je to definice „odehrané bleskovky",
  konzistentní s pravidlem „postup POUZE za odehraná kola/dokončené bleskovky".

## R4 — Idempotence advance: unikátní constraint na sessionId

Advance běží uvnitř stávající finish transakce. Dvojitou ochranu dávají:
- `updateMany where status=RUNNING` guard ve finish (existující) — finish
  proběhne právě jednou,
- `CampaignStepUnlock.sessionId @unique` — jedna session může odemknout
  nejvýš jeden krok, i kdyby se advance kdy volal jinou cestou,
- `@@unique([progressId, stepIndex])` — souběžné finishe dvou session téže
  třídy se serializují přes P2002 + jeden retry s přečtenou pozicí.

## R6 — Vzkaz minulé třídy: reveal pojistka (schváleno ráno 2026-07-17)

Doplnění od Tomáše při schválení Bloku 1: `epilogueMessage` píše učitel
dokončené kampaně, ale budoucí třídě se NIKDY nezobrazí automaticky.
Model: přijímající `CampaignProgress` má `predecessorProgressId` (snapshot
zdroje vzkazu při startu kampaně — nejnovější COMPLETED progress téže
kampaně v téže org s neprázdným vzkazem, mimo vlastní třídu)
a `predecessorMessageRevealedAt`. Kontrakt stejný jako u correctKey:
- projekční/board endpoint vzkaz NEVRACÍ, dokud `revealedAt` není nastaven,
- učitel budoucí třídy má teacher-only preview endpoint (přečte si ho první),
- explicitní `POST .../predecessor-message/reveal` teprve vzkaz pustí na
  projekci (idempotentní).

## R5 — Cílení kampaně podle ročníku, ne podle LiveAgeMode

`LiveAgeMode` (YOUNG ≤ 3. třída) nesedí na hranici 1./2. stupně (5./6. třída).
Campaign JSON proto cílí rozsahem `targetGrades: { min, max }` nad enumem
`SchoolGrade`; list endpoint filtruje podle `grade` třídy. Prezentační
`ageMode` session zůstává nedotčený a nezávislý.
