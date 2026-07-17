# Vizuální QA — nálezy (2026-07-17)

Průchod: showcase data (ZŠ a Gymnázium Jasmínová, `seed:showcase`), role
student young (2.B) / student old (8.A) / teacher / director, viewporty
1920/1280/768/390. Konzole sbírána automatizovaným sweepem přes hlavní routy
(4 role × 27 rout); horizontální přetečení měřeno programově (žádné nenalezeno).

## BLOCKER (opraveno rovnou v této větvi)

| # | Nález | Oprava |
| --- | --- | --- |
| B1 | **Knihovna padala do AppErrorBoundary** — `ContentLibraryList` renderoval `item.subject` (objekt relace Subject) přímo jako React child; crash pro učitele i žáka, jakmile knihovna nebyla prázdná | `subjectLabel()` helper + typ `ContentItem.subject` rozšířen na objekt; filtr předmětu normalizován ([content-library-list.tsx](../client/src/components/content/content-library-list.tsx)) |
| B2 | **Výsledky: risk-overview a subject-performance vracely 403 učiteli s úvazkem** — kontrola pouštěla jen homeroom učitele (`classSection.teacherId`), úvazek přes `TeacherClassSection` nestačil (nekonzistentní se zbytkem třídních endpointů). Early Warning Panel se učiteli nenačetl | obě místa v [class-sections.service.ts](../server/src/classroom/class-sections.service.ts) rozšířena o `activeTeacherAccessCondition` (homeroom NEBO platný úvazek) |

## VISUAL (nehezké, sepsáno — neopravováno)

Řazeno doporučeným pořadím oprav (dopad × viditelnost):

1. **Lokalizace zbytků EN** na žákovských a učitelských obrazovkách:
   „Gamification" (student dashboard), „Priority alerts" (Výsledky),
   „Assignment" + „Open:/Close:" (karta zadání — žák vidí anglický nadpis!),
   „Search lesson plans..." (Knihovna), „Student timeline" + dev label
   „Sprint 3" (analytika).
2. **Select tříd ve Výsledcích ukazuje syrový enum**: „GRADE_2. B (2.B)" —
   formátovat na „2.B"; zvážit default na homeroom třídu učitele (teď první
   v seznamu, klidně prázdná).
3. **Odpočet „Konec 342:24:42" ve focus testu** — u zadání s oknem na týdny
   vypadá jako rozbitý časovač; nad ~48 h zobrazit datum konce místo h:m:s.
4. **Risk heuristika u tříd bez odevzdání**: třída bez jediného odevzdání
   (nová/loňská) = „Vysoké riziko" a všichni žáci „Nízký průměr, Neaktivita"
   s 0 % — na ředitelském dashboardu působí jako požár; rozlišit „bez dat".
5. **Mobilní hlavička (390px)** — horní lišta se láme do 3 řádků (Přehled /
   brand + Moje zadání / chip role + avatar); zaslouží kompaktní variantu.
6. **Vokativ v pozdravu**: „Ahoj, Anička!" → „Ahoj, Aničko!" — pozdrav skládá
   nominativ ze jména; buď vokativ (skloňování), nebo neutrální formulace.
7. **Student timeline pod ředitelem** — stránka je studentská, řediteli tiše
   spadne request (400 v konzoli) a ukáže prázdný stav; schovat z navigace
   pro ne-studenty nebo přidat vysvětlující stav.
8. **Recharts barvy natvrdo** (audit Fáze 4): `#16A34A`, `#0ea5e9`, `#94a3b8`,
   `#E5E7EB` v results-chart, PerformanceTrend, student-timeline — grafy
   ignorují tokeny (a případný tmavý režim). Stejně tak 3 ojedinělé
   `[--tactile-shadow:#…]` (PendingTasks, DirectorCommandCenter,
   test-top-status-bar) místo `rgb(var(--…))`.
9. **Legacy `slate-*` třídy: 106 souborů** (viz `grep -rln "slate-[0-9]" src`)
   — známý dluh Fáze 4; největší koncentrace: results/, tests/, settings/,
   audit/, library/. Doporučené pořadí: žákovské obrazovky → učitelské →
   admin/audit.

## NICE (nápady)

- Sbírka samolepek: po kliknutí na samolepku zvětšený detail se scénou
  zastávky (dnes bez interakce).
- Bleskovka young board: parťák komentuje jen outcome — mohl by reagovat
  i na reveal (drobná animace).
- Director dashboard: karta „Kampaně ve škole" (kolik tříd má rozehranou
  Výpravu/Misi) — bez srovnávání, jen počty.
- Portfolio frame skript by mohl umět i mobilní rámeček (telefon) pro
  390px záběry.

## Konzole

Po opravách B1/B2 je sweep čistý s jedinou výjimkou: ředitel na
`/app/analytics/student-timeline` (nález VISUAL #7). Žádné React warningy
(keys, hydration) se během průchodu neobjevily.

## Hodnocení obrazovek

**Nejsilnější (kandidáti na hero shot):**

1. **Ředitelský přehled** (`11-director-analytika`) — čtyři metriky, výkon
   tříd, aktivita učitelů, žáci v ohrožení a poznámka „Proč tu nevidíte
   parťáky žáků?" na jedné obrazovce; působí jako hotový produkt a
   komunikuje hodnoty (bezpečný prostor) bez jediného slova navíc.
2. **Mapa Výpravy se sbírkou samolepek** (`09-vyprava-mapa-samolepky`) —
   nejvíc „vlastní" obrazovka celé aplikace, okamžitě odlišitelná od
   generických LMS; ilustrace drží tokeny a příběh je čitelný na první
   pohled. Hero pro sekci „pro 1. stupeň".
3. **Bleskovka senior board** (`08-bleskovka-senior`) — tmavý quiz-night
   vzhled s barevnými dlaždicemi je kontrastní protiváha světlému zbytku;
   ve dvojici se young boardem (`06`) skvěle ukazuje věkové režimy jedním
   pohledem.

**Nejslabší a co by pomohlo:**

1. **Zadání žáka (`/app/assignments`)** — anglický nadpis „Assignment",
   surové Open/Close datumy, žádný název testu na kartě. Pomohla by karta
   s názvem testu, předmětem a stavem (VISUAL #1 + refaktor karty).
2. **Výsledky pro třídu bez dat** — samé 0 % a červené tečky (VISUAL #4);
   prázdný stav „zatím žádná odevzdání" s výzvou k akci by byl přívětivější.
3. **Knihovna** — po opravě B1 funkční, ale vizuálně nejstarší vrstva
   (slate-*, EN placeholder, karty bez náhledů). Kandidát na první krok
   Fáze 4 migrace (VISUAL #9).
