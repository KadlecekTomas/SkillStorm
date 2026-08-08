# SkillStorm — Portfolio Screenshot Index

> **Status:** `CURRENT / RUNBOOK`  
> **Owner:** Product + Engineering  
> **Last verified:** 2026-08-07  
> **Scope:** reproducible portfolio/showcase screenshot set generated from deterministic showcase data; presentation asset index, not product/curriculum authority  
> **Executable authority:** `server` script `seed:showcase`, `client` script `portfolio:shots`, `client/playwright.portfolio.config.ts` and the generated files in this directory.

---

Prezentační screenshoty nad showcase daty **„ZŠ a Gymnázium Jasmínová"**
(1920×1080, čeština, deterministická scénografie). Všechny záběry vznikají
jedním během — data si napříč obrazovkami odpovídají.

**Přegenerování** (vždy celá sada, nikdy jednotlivě):

```bash
cd server && npm run seed:showcase        # čerstvá scénografie (povinné!)
cd client && npm run portfolio:shots      # předpoklad: dev stack (viz playwright.portfolio.config.ts)
```

Oba skripty jsou na aktuální větvi definované v příslušných `package.json`; při jejich přejmenování musí být tento runbook aktualizován ve stejném PR.

Legenda použití: **hero** = úvodní velký vizuál sekce/stránky ·
**sekce** = ilustrace konkrétní kapitoly · **pár** = dvojice záběrů vedle sebe ·
**detail** = výřez 1200×800 pro střídání textu a obrazu na landing page.

> **Důležité:** screenshoty dokumentují showcase stav produktu v okamžiku posledního přegenerování. Nejsou důkazem, že budoucí `VISION` funkce už existují ani že konkrétní školní/curriculum claim prošel production gate.

---

## Hero triptych

Tři nejsilnější obrazovky — projdou pixel-perfect kontrolou (žádné přetečení,
scrollbar ani toast). U všech existuje i `.framed.png` varianta v browser
mockupu (světlý podklad `--canvas-alt`, jemný stín, bez gradientů).

| Záběr | Použití |
| --- | --- |
| ![Ředitelská analytika](11-director-analytika.png) **11-director-analytika** | **hero** hlavní landing page — čtyři metriky, výkonnost tříd, rizikoví žáci a poznámka „Proč tu nevidíte parťáky žáků?" na jedné obrazovce. |
| ![Mapa Výpravy](09-vyprava-mapa-samolepky.png) **09-vyprava-mapa-samolepky** | **hero** sekce „pro 1. stupeň" — parťák uprostřed cesty (4/8), sbírka samolepek vypráví postup třídy. |
| ![Bleskovka senior](08-bleskovka-senior.png) **08-bleskovka-senior** | **hero** sekce „pro střední školy" — tmavý quiz-night režim, kontrastní protiváha světlého zbytku webu. |

## Párové záběry

| Záběr | Použití |
| --- | --- |
| ![Bleskovka young](06-bleskovka-young.png) **06-bleskovka-young** + ![Bleskovka senior — stejná otázka](15-par-bleskovka-senior.png) **15-par-bleskovka-senior** | **pár** „roste s dětmi" — tatáž otázka jednou jako hravé dlaždice s parťákem, podruhé jako večerní kvíz. |
| ![Student desktop](16-par-student-dashboard-desktop.png) **16-par-student-dashboard-desktop** + ![Student mobil](12-mobil-student-dashboard.png) **12-mobil-student-dashboard** | **pár** „desktop i mobil" — stejná žákyně, stejný den, dvě obrazovky vedle sebe. |

## Sekce — celé obrazovky

| Záběr | Použití |
| --- | --- |
| ![Student dashboard](01-student-dashboard-partak.png) **01-student-dashboard-partak** | **sekce** „žákovský zážitek" — parťák, streak, úroveň a čekající/hotové testy. |
| ![Young test](02-student-test-young-dlazdice.png) **02-student-test-young-dlazdice** | **sekce** „přívětivé testy pro nejmenší" — velké dlaždice. |
| ![Old test s časovačem](03-student-test-old-casovac.png) **03-student-test-old-casovac** | **sekce** „soustředěný režim" — časovač, přehled otázek, autosave. |
| ![Teacher dashboard](04-teacher-dashboard.png) **04-teacher-dashboard** | **sekce** „učitelský kokpit" — Bleskovka, fronta vyhodnocení, třídy a poslední odevzdání. |
| ![Builder](05-teacher-test-builder-krok2.png) **05-teacher-test-builder-krok2** | **sekce** „tvorba testu" — wizard krok 2. |
| ![Bleskovka middle](07-bleskovka-middle.png) **07-bleskovka-middle** | záloha k 06/15, třetí věkový režim (2. stupeň). |
| ![Archiv](10-archiv-nastenka-fragment.png) **10-archiv-nastenka-fragment** | **sekce** „kampaně pro starší" — dešifrovaný fragment + zapečetěný vzkaz. |
| ![Vzkaz 9.A](10b-archiv-vzkaz-lonske-9a.png) **10b-archiv-vzkaz-lonske-9a** | **sekce/detail** — otevřený predecessor message. |
| ![Mobil zadání](13-mobil-student-zadani.png) **13-mobil-student-zadani** | **sekce** mobilní flow — seznam zadání. |
| ![Mobil test](14-mobil-student-test.png) **14-mobil-student-test** | **sekce** mobilní flow — vyplňování testu na telefonu. |

## Detailní výřezy (1200×800)

| Záběr | Použití |
| --- | --- |
| ![Parťák hero karta](17-detail-partak-hero-karta.png) **17-detail-partak-hero-karta** | **detail** k sekci gamifikace — parťák + XP + úroveň. |
| ![Streak pilulky](18-detail-streak-pilulky.png) **18-detail-streak-pilulky** | **detail** — XP, úroveň a streak. |
| ![Tactile outcome](19-detail-tactile-outcome.png) **19-detail-tactile-outcome** | **detail** — odhalená odpověď + taktilní outcome tlačítka. |
| ![XP konec výpravy](20-detail-xp-konec-vypravy.png) **20-detail-xp-konec-vypravy** | **detail** — ClassParták progress po Bleskovce. |

## Guardian — rodinný prostor

| Záběr | Použití |
| --- | --- |
| ![Rodinný prostor](21-rodic-rodinny-prostor.png) **21-rodic-rodinny-prostor** | **hero kandidát** — rodičovský přehled bez žákovského XP/Parťáka. |
| ![Rodinný prostor mobil](21b-rodic-rodinny-prostor-mobil.png) **21b-rodic-rodinny-prostor-mobil** | mobilní varianta. |
| ![Potvrzení dítěte](22-rodic-potvrzeni-ditete-mobil.png) **22-rodic-potvrzeni-ditete-mobil** | onboarding rodiče. |
| ![Arch kódů](23-ucitel-arch-kodu-pro-rodice.png) **23-ucitel-arch-kodu-pro-rodice** | učitelský tisknutelný arch párovacích kódů. |
| ![Spuštění aktivity](24-rodic-spusteni-aktivity.png) **24-rodic-spusteni-aktivity** | rodinné spuštění žákovské aktivity. |
| ![Žákovský režim](25-zak-rezim-spusteno-rodicem.png) **25-zak-rezim-spusteno-rodicem** | žákovský režim spuštěný rodičem. |
| ![Návrat po režimu](26-navrat-po-zakovskem-rezimu.png) **26-navrat-po-zakovskem-rezimu** | návratová obrazovka po žákovském režimu. |

Záběry s relačními/kódovými showcase daty vyžadují před celou sadou čerstvý `seed:showcase`; neprovádějte selektivní ruční „opravy" dat pro jeden screenshot.

## Framed varianty

`01 / 04 / 08 / 09 / 11 + .framed.png` — browser mockup pro hero pozice, kde je potřeba „zařízení" místo surového screenshotu. Stejný zoom i data jako zbytek sady.

---

## Definition of Done pro přegenerování

```text
[ ] seed:showcase dokončen bez chyby
[ ] portfolio:shots dokončen bez Playwright chyby
[ ] celá sada vznikla z jednoho konzistentního seed běhu
[ ] žádný screenshot neobsahuje toast/debug overlay/scrollbar nebo přetečení
[ ] citlivá/reálná data nejsou v showcase sadě
[ ] názvy screenshotů odpovídají tomuto indexu
[ ] změněný produktový stav je v indexu popsán bez marketingového přehánění
```

> **Portfolio screenshot je prezentační artefakt. Production readiness dokazuje kód, testy a current/normative contracts — ne obrázek.**