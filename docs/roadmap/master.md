# SkillStorm — Master Roadmap

> **Jediný zdroj pravdy o pořadí a prioritách.** Všechny dílčí roadmapy a zadání na tento dokument odkazují; při konfliktu platí tento dokument.
> **Vlastník:** Profesor · **Poslední revize:** 20. 7. 2026 · Revidovat po každém dokončeném milníku a po pilotu.

---

## Kde jsme (hotovo a v provozu)

| Oblast | Stav |
|---|---|
| Design systém (Notion × Duolingo, tokeny, tactile, parťák) | ✅ v mainu, Fáze 0–3 |
| Produkční hardening (DB izolace + guard, zálohy s restore, row lock, rate limiting + trust proxy, Sentry se scrubbingem, RBAC/tenant audit) | ✅ PR #9 |
| Scénářová Playwright sada (17→21+ scénářů, CI na každý PR, 3× stabilní) | ✅ PR #10 |
| Bleskovky režim B (LiveSession, věkové režimy young/middle/senior, XP jen za účast) | ✅ |
| Kampaně (Výprava, Mise/Archiv, ClassPartak, content jako JSON) | ✅ |
| Hlasování na tabuli (voteCounts, auto-outcome, graf) | ✅ v mainu (PR #17) |
| Dotykové interakce (MATCH/ORDER/SORT, server-side soudce, latence-odolné UI) | ✅ v mainu |
| Teacher-scope RBAC audit (učitel s úvazky bez třídnictví) | ✅ v mainu (PR #18) |
| Portfolio pipeline (showcase seed, 17+ záběrů, hero triptych) | ✅ |
| Demo obsah (sady napříč předměty a stupni) | ✅ draft, čeká na učitelskou revizi |
| Guardian Etapa A — multi-role Membership (MembershipRoleAssignment, activeRole v JWT, switch-role) | ✅ v mainu (PR #21) |
| Stabilita e2e (order-dependent „socket hang up" — supertest port churn) | ✅ v mainu (PR #22) |

## Princip řízení fronty

1. **Jedna rozdělaná vertikála naráz.** Rozptýlenost zabíjí úspěch rychleji než pomalost.
2. **Pilot je brána.** Vertikály za bránou pilotu se nezačínají, dokud pilot neběží — jejich návrh bude po zpětné vazbě z reálných tříd výrazně lepší.
3. **Neporušitelné principy platí napříč** (odměny za účast/snahu, nikdy za skóre; žádné srovnávání dětí ani tříd; parťák neviditelný pro dospělé; oddělené identity; server jako soudce; žádné soc. sítě; XP se neprodává).
4. Každý velký projekt má vlastní dokument se STOP checkpointy; tento soubor drží jen pořadí a proč.

---

## Fronta

### ✅ 0. Dokončit rozdělané — SPLNĚNO (20. 7. 2026)
board-voting (#17), board-interactions i teacher-class-scope (#18) jsou v mainu; main zelený, branch protection s required checks drží. Zbytek: chore/portfolio-polish (rebase + PR v běhu — serverové opravy risk-model/stats musí do mainu před Etapou B).

### 🔴 1. Guardian — Rodinný prostor a rodičem spouštěné aktivity
**Dokument:** `docs/guardian-project.md` · Etapy A (multi-role) → B (vazba + prostor) → C (relace + provenance) → D (audit).
Největší architektonický zásah v historii repa (Etapa A sahá na Membership). Proto jede první a sám — žádná paralelní vertikála. STOP #1 (multi-role model) je nejdůležitější review projektu.
**Stav:** Etapa A ✅ v mainu (PR #21, 20. 7.). Další krok: **Etapa B (vazba + rodinný prostor), STOP #2.**

### 🟠 2. OSTRÝ PILOT — brána všeho dalšího
Ne kód, ale nasazení: EU hosting dle production-readiness.md, provozní kroky (backup cron, Sentry DSN, uptime), zpracovatelská smlouva s právníkem, revize demo obsahu učitelským okem.
**Průběh:** vlastní třída (Bleskovka + Archiv K1) → 2–3 kolegové (testy, Výprava na 1. stupni) → celá škola.
**Sbírá se:** kde se zasekl učitel, kde žák; udrží kampaň pozornost; chlubí se děti parťákem sama (vstup pro Parťák 2.0); citace a čísla pro referenci; odpovědi na 5 otázek z partak-2.0.md.
**Výstup:** iterační backlog řízený realitou + první reference. Bez tohoto se fronta níže neotevírá.
**Rozhodnutí 20. 7. 2026:** Google Workspace onboarding (větev `feat/google-workspace-onboarding`, mimo main) dokončit **před pilotem celé školy, po Etapě B**. Větev se nerebasuje — po měsíci driftu (multi-role refactor) se přenese cherry-pick plánem dle inventury.

### 🟡 3. Notifikace a oznámení (rodiče + žáci)
Stojí na guardian vazbě (Etapa B už nese preference per rodič-dítě). Rozsah: jednosměrná oznámení s potvrzením přečtení — „test zadán/odevzdán", termíny („peníze na výlet do 23. 9."), třídní informace („sešity na předměty"). Kanály: in-app, e-mail, push. **Ne:** plný chat, soc. sítě. Messaging až na základě poptávky z pilotu.

### 🟡 4. Materiály — statistiky a marketplace
Strategicky nejcennější dlouhodobá vertikála (síťový efekt: učitel s používaným obsahem neodchází). Rozsah: sdílení při vytvoření (škola / platforma / soukromé), hvězdičky, počty stažení, autorství („test od učitele XX"), obtížnost/relevance; odměny = reputace autora (badge, viditelnost), **ne XP**. Vyžaduje kritickou masu učitelů → po pilotu. AI podobnost vůči zadání: odloženo (drahé, nepoptávané).

### 🟢 5. Parťák 2.0
**Dokument:** `docs/roadmap/partak-2.0.md` · Výběr mazlíčka → evoluční řady → album → hmotné odměny („krabice", platí výhradně dospělí, žádný prodej XP). Brána: odpovědi z pilotu (5 otázek v dokumentu). Největší náklad: ilustrace (~40 assetů, profesionálně).

### 🟢 6. Offline projekce Bleskovek
PWA + stažené balíčky sad, lokální engine, idempotentní sync (kotvy existují). Vědomá výjimka threat modelu: offline balíček = učitelův kontext, smí nést řešení; online invariant trvá. Prodejní argument pro školy se slabou konektivitou. Začít až po board-interactions (sdílí vyhodnocovací engine).

### 🔵 7. Bleskovky režim A (zařízení žáků)
WebSockets, join kódem/QR, LiveSessionParticipant (šev připraven), přesné voteCounts ze zařízení. Až bude režim B prokazatelně bavit třídy — režim A je zesílení fungující smyčky, ne záchrana nefungující.

### 🔵 8. Practice mode + domácí procvičování → příprava na přijímačky
Dlouhá vize s největším B2C potenciálem (trh přípravy na přijímačky). Vyžaduje: practice session s answer key (dnes záměrně neexistuje), obsahovou knihovnu dle RVP (krmí ji vertikála 4), doporučování. Rodičovské spouštění už bude existovat (guardian C). Samostatný projektový dokument až po startu vertikály 4.

---

## Průběžné (nevlastní slot ve frontě)
Analytika pro učitele: medián/modus vedle průměru (malé, kdykoli). **Zamítnuto trvale:** percentilové srovnávání žáků („lepší/horší žák v %") — koliduje s principem 3; žák se srovnává jen se svou minulostí. Fáze 4 sweep barev (~106 souborů): mechanická dávka, vhodná jako výplň mezi etapami. Accessibility (axe) a persistence přes restart: před nasazením mimo vlastní školu.

## Go-to-market (běží paralelně od pilotu)
Freemium zdola: Bleskovky zdarma pro jednotlivého učitele (virální motor) → školní licence (testování, profily, analytika, guardian, podpora; paušál dle velikosti školy). Kanály: učitelské FB skupiny, DVPP, letní školy, webináře. Reference z vlastní školy = první prodejní materiál. Landing page: hero triptych + „bez osobních údajů dětí (režim B)" + „parťák není metrika" + po vertikále 6 „funguje i bez internetu".

---

## Revizní log
| Datum | Změna |
|---|---|
| 2026-07-20 | Slot 0 splněn: board-voting (#17), board-interactions, teacher-class-scope (#18) v mainu. Guardian Etapa A mergnuta (#21); e2e „socket hang up" flake vyřešen (#22, supertest port churn → persistentní server per suite). Etapa B odblokována. Workspace onboarding: dokončit před pilotem celé školy, po Etapě B (bez rebasu, cherry-pick plán). Zbývá z rozdělaného: chore/portfolio-polish → PR. |
| 07/2026 | První verze — konsolidace po dokončení kampaní, hlasování a guardian/parťák dokumentů. |