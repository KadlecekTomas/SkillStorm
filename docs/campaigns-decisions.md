# Kampaně — rozhodnutí mimo plán (noční log)

Formát: každé rozhodnutí má možnosti, výběr a důvod. Ráno projít.

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

## R5 — Cílení kampaně podle ročníku, ne podle LiveAgeMode

`LiveAgeMode` (YOUNG ≤ 3. třída) nesedí na hranici 1./2. stupně (5./6. třída).
Campaign JSON proto cílí rozsahem `targetGrades: { min, max }` nad enumem
`SchoolGrade`; list endpoint filtruje podle `grade` třídy. Prezentační
`ageMode` session zůstává nedotčený a nezávislý.
