# Portfolio záběry — SkillStorm

Prezentační screenshoty nad showcase daty **„ZŠ a Gymnázium Jasmínová"**
(1920×1080, čeština, deterministická scénografie). Všechny záběry vznikají
jedním během — data si napříč obrazovkami odpovídají.

**Přegenerování** (vždy celá sada, nikdy jednotlivě):

```bash
cd server && npm run seed:showcase        # čerstvá scénografie (povinné!)
cd client && npm run portfolio:shots      # předpoklad: dev stack (viz playwright.portfolio.config.ts)
```

Legenda použití: **hero** = úvodní velký vizuál sekce/stránky ·
**sekce** = ilustrace konkrétní kapitoly · **pár** = dvojice záběrů vedle sebe ·
**detail** = výřez 1200×800 pro střídání textu a obrazu na landing page.

---

## Hero triptych

Tři nejsilnější obrazovky — projdou pixel-perfect kontrolou (žádné přetečení,
scrollbar ani toast). U všech existuje i `.framed.png` varianta v browser
mockupu (světlý podklad `--canvas-alt`, jemný stín, bez gradientů).

| Záběr | Použití |
| --- | --- |
| ![Ředitelská analytika](11-director-analytika.png) **11-director-analytika** | **hero** hlavní landing page — čtyři metriky, výkonnost tříd, rizikoví žáci a poznámka „Proč tu nevidíte parťáky žáků?" na jedné obrazovce. Produkt vypadá hotově a komunikuje hodnoty beze slov. |
| ![Mapa Výpravy](09-vyprava-mapa-samolepky.png) **09-vyprava-mapa-samolepky** | **hero** sekce „pro 1. stupeň" — nejosobitější obrazovka aplikace, parťák uprostřed cesty (4/8), sbírka samolepek vypráví postup třídy. |
| ![Bleskovka senior](08-bleskovka-senior.png) **08-bleskovka-senior** | **hero** sekce „pro střední školy" — tmavý quiz-night režim, kontrastní protiváha světlého zbytku webu. |

## Párové záběry

| Záběr | Použití |
| --- | --- |
| ![Bleskovka young](06-bleskovka-young.png) **06-bleskovka-young** + ![Bleskovka senior — stejná otázka](15-par-bleskovka-senior.png) **15-par-bleskovka-senior** | **pár** „roste s dětmi" — tatáž otázka jednou jako hravé dlaždice s parťákem, podruhé jako večerní kvíz. Nejrychlejší způsob, jak ukázat věkové režimy. |
| ![Student desktop](16-par-student-dashboard-desktop.png) **16-par-student-dashboard-desktop** + ![Student mobil](12-mobil-student-dashboard.png) **12-mobil-student-dashboard** | **pár** „desktop i mobil" — stejná žákyně (Anička, 2.B), stejný den, dvě obrazovky vedle sebe. |

## Sekce — celé obrazovky

| Záběr | Použití |
| --- | --- |
| ![Student dashboard](01-student-dashboard-partak.png) **01-student-dashboard-partak** | **sekce** „žákovský zážitek" — parťák, streak 6 dní, úroveň v půlce, 2 čekající testy, hotový test s 86 %. |
| ![Young test](02-student-test-young-dlazdice.png) **02-student-test-young-dlazdice** | **sekce** „přívětivé testy pro nejmenší" — velké dlaždice, žádný stres. |
| ![Old test s časovačem](03-student-test-old-casovac.png) **03-student-test-old-casovac** | **sekce** „soustředěný režim" — časovač, přehled otázek, autosave. |
| ![Teacher dashboard](04-teacher-dashboard.png) **04-teacher-dashboard** | **sekce** „učitelský kokpit" — Bleskovka na jedno kliknutí, fronta vyhodnocení, třídy a poslední odevzdání. |
| ![Builder](05-teacher-test-builder-krok2.png) **05-teacher-test-builder-krok2** | **sekce** „tvorba testu" — wizard krok 2. |
| ![Bleskovka middle](07-bleskovka-middle.png) **07-bleskovka-middle** | záloha k 06/15, třetí věkový režim (2. stupeň). |
| ![Archiv](10-archiv-nastenka-fragment.png) **10-archiv-nastenka-fragment** | **sekce** „kampaně pro starší" — dešifrovaný fragment K1 + zapečetěný vzkaz. |
| ![Vzkaz 9.A](10b-archiv-vzkaz-lonske-9a.png) **10b-archiv-vzkaz-lonske-9a** | **sekce/detail** — otevřený vzkaz od loňské 9.A; detail, který vypráví (třídy si předávají štafetu). |
| ![Mobil zadání](13-mobil-student-zadani.png) **13-mobil-student-zadani** | **sekce** mobilní flow — seznam zadání s předmětem a termíny. |
| ![Mobil test](14-mobil-student-test.png) **14-mobil-student-test** | **sekce** mobilní flow — vyplňování testu na telefonu. |

## Detailní výřezy (1200×800)

Pro landing page bloky „text vlevo, detail vpravo" — bez app shellu.

| Záběr | Použití |
| --- | --- |
| ![Parťák hero karta](17-detail-partak-hero-karta.png) **17-detail-partak-hero-karta** | **detail** k sekci gamifikace — parťák + XP + úroveň na jedné kartě. |
| ![Streak pilulky](18-detail-streak-pilulky.png) **18-detail-streak-pilulky** | **detail** — pilulky ⚡ XP · Úroveň · 🔥 dny v řadě zblízka. |
| ![Tactile outcome](19-detail-tactile-outcome.png) **19-detail-tactile-outcome** | **detail** — odhalená odpověď + taktilní tlačítka výsledku kola (Většina správně / Půl napůl / Většina špatně). |
| ![XP konec výpravy](20-detail-xp-konec-vypravy.png) **20-detail-xp-konec-vypravy** | **detail** — +XP a parťákův progress bar na konci expediční Bleskovky. |

## Guardian — rodinný prostor (Etapa B)

| Záběr | Použití |
| --- | --- |
| ![Rodinný prostor](21-rodic-rodinny-prostor.png) **21-rodic-rodinny-prostor** | **hero kandidát prodejní stránky** — „rodič vidí, co dítě potřebuje": přepínač dětí, doporučený další krok, lidské termíny, žádný parťák/XP. |
| ![Rodinný prostor mobil](21b-rodic-rodinny-prostor-mobil.png) **21b-rodic-rodinny-prostor-mobil** | mobilní varianta (rodiče = mobil), 390 px. |
| ![Potvrzení dítěte](22-rodic-potvrzeni-ditete-mobil.png) **22-rodic-potvrzeni-ditete-mobil** | onboarding rodiče — „Je Vojta Hruška vaše dítě?", dvě velká tlačítka, žádný formulář. |
| ![Arch kódů](23-ucitel-arch-kodu-pro-rodice.png) **23-ucitel-arch-kodu-pro-rodice** | učitelský pohled — tisknutelný arch lístečků s párovacími kódy (jméno + kód + 3 kroky + platnost), rozstříhatelný, tisk z prohlížeče. |

Pozn.: záběr 23 generuje reálné jednorázové kódy — před dalším během sady
vždy `seed:showcase` (platí pro celou sadu, viz hlavička skriptu).

## Framed varianty

`01 / 04 / 08 / 09 / 11 + .framed.png` — browser mockup pro hero pozice, kde
je potřeba „zařízení" místo surového screenshotu. Stejný zoom i data jako
zbytek sady.
