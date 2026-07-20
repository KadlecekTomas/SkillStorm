Guardian — Rodinný prostor a rodičem spouštěné aktivity

Status: schváleno k implementaci · Priorita: nejvyšší (před pilotem rodičovské části) Zdroj pravdy pro všechny Claude Code sessions tohoto projektu. Nadřazeno dílčím zadáním. Navazuje na původní specifikaci „Zjednodušení rodičovského prostředí" — tento dokument ji krájí do bezpečných etap, doplňuje rozhodnutí zadavatele a fixuje invarianty.

1. Vize jednou větou

Rodič bez technických znalostí do 30 sekund od přihlášení ví, co jeho dítě potřebuje udělat a jak se mu daří — a na společném zařízení mu umí bezpečně předat ruku, aniž by kdy splynuly jejich identity nebo se zpochybnila důvěryhodnost školních výsledků.

2. Proč to stavíme (strategický kontext)
Pro školy: rodičovský přístup je standardní požadavek při nákupu (Bakaláři ho mají; my ho musíme mít lepší a jednodušší).
Pro platformu: guardian vazba je základ budoucích vertikál — notifikace rodičům, domácí procvičování, příprava na přijímačky, fyzické odměny (Parťák 2.0 Fáze 4). Bez ní žádná z nich nejde postavit.
Pro důvěru: provenance odevzdání („kdo spustil, kdo byl ověřen") je věc, kterou nemá nikdo na českém trhu — a je to odpověď na reálnou bolest učitelů s domácími úkoly.
3. Neporušitelné principy
Oddělené identity, vždy. Rodič a dítě nikdy nesdílejí účet, profil ani session. „Rodinný prostor" je UI vrstva nad oddělenými identitami, nikoli společný účet. (Rozhodnuto — návrhy „společného profilu" se zamítají s odkazem sem.)
Výsledek patří dítěti, provenance říká pravdu. Každé odevzdání nese: komu patří, kdo relaci spustil, jak bylo dítě ověřeno, zda byla deklarována pomoc. Systém nikdy nevytváří falešný dojem samostatné práce.
Server je jediný soudce identity. studentId z frontendu se nikdy nepřijímá bez ověření vztahu a oprávnění na backendu. Cross-tenant = 404, cizí dítě = 403.
Klasifikované testy jsou konzervativní defaultem. Výchozí pravidlo nikdy nepovažuje rodičem spuštěný test za ověřený samostatný výkon. Učitel režim spuštění volí explicitně.
Parťák dítěte není v rodičovském rozhraní. Žádná XP, úrovně, samolepky, postup mazlíčka. Stejný princip jako u učitelů a ředitelů — bezpečný prostor dítěte definuje to, že se do něj nikdo nedívá. Výjimka (volitelné „momenty" bez čísel) se rozhodne až po pilotu; do té doby nula.
Jednoduchý jazyk, jedna dominantní akce. Rodičovské UI mluví česky a lidsky („Odevzdat do pátku", ne „Assignment expiration"). Basic zobrazení je default pro všechny; „Zobrazit více podrobností" mění jen prezentaci, nikdy oprávnění.
Žádné sociální sítě, žádný tracking třetích stran. Notifikační kanály: in-app, e-mail, případně push. Nic jiného. (Rozhodnuto.)
4. Etapy a checkpointy

Každá etapa = vlastní branch + vlastní PR + merge před startem další. Body 21 (povinný postup) a 22 (výstupní report s verdiktem) původní specifikace platí pro každou etapu zvlášť.

ETAPA A — Multi-role Membership (základ všeho)

Branch: refactor/multi-role-membership · Pokrývá bod 10 specifikace.

Jeden člověk musí umět být současně učitel a rodič, ředitel a rodič, rodič ve více organizacích. Žádné if teacher and parent výjimky.

Krok 1 — analýza: zmapovat VŠECHNY závislosti na Membership.role (RBAC guardy, login, navigace, audit, API, seedy, testy). Výstup: úplný seznam dotčených míst + návrh modelu (MembershipRoleAssignment nebo ekvivalent) + migrační strategie zachovávající všechna současná oprávnění.
STOP #1 — nejdůležitější review projektu. Bez explicitního schválení návrhu se nepíše ani řádek implementace.
Krok 2 — implementace + migrace. Aditivní kde to jde; stávající single-role uživatelé fungují identicky (kryto kompletním regresním během: ~400 server e2e, 21+ scénářů, unit).
Definition of done: main zelený, žádná změna chování pro existující uživatele, dokumentovaný nový model rolí, branch protection prošla.
ETAPA B — Guardian vazba + Rodinný prostor

Branch: feature/guardian-space · Pokrývá body 1, 3, 4, 8, 9, 11, 15.

STOP #2 — datový model: GuardianStudentRelation (rodič ↔ žák, org, typ, stav PENDING/VERIFIED/REVOKED, kdo ověřil, oprávnění per dítě, audit timestamps, datum ukončení) + model oprávnění rodiče vyhodnocovaný vůči konkrétnímu dítěti (bod 9) + žákovské účty bez e-mailu (username, PIN, QR, školní kód; SSO jako šev).
Párování řízené školou: vazbu zakládá škola (pozvánka e-mailem, jednorázový kód, QR, schválení školou). Žádné samoobslužné „najdi si dítě".
Rodinný prostor: přepínač dětí (jméno, avatar, třída; jedno dítě = auto-výběr), a na dítě jedna obrazovka se čtyřmi bloky: Co je potřeba udělat (úkoly/testy/termíny), Jak se dítěti daří (lidský souhrn, žádné grafy v basic), Zprávy (zatím jen školní oznámení, plný messaging NE), Doporučený další krok (jedna akce).
Basic/detail: basic default pro všechny, „Zobrazit více podrobností" jako uživatelská preference (enum, ne string). Žádné labely typu „režim pro seniory".
Onboarding rodiče: max 3 kroky (potvrzení dítěte → důležitá upozornění → přehled). Konfigurace ničeho, co rodič teď nepotřebuje.
Definition of done: rodič se registruje kódem od školy, vidí výhradně svá ověřená děti (e2e: cizí dítě 403, cizí tenant 404, REVOKED = okamžitý konec přístupu), parťák nikde.
ETAPA C — Žákovské relace + provenance

Branch: feature/guardian-sessions · Pokrývá body 2, 5, 6, 7, 12, 13, 18.

STOP #3 — model relací a bezpečnosti: LearningSession (dítě, iniciátor, způsob zahájení, způsob ověření dítěte, deklarovaná pomoc, začátek/konec/expirace, stav, org) + submission provenance (FK na relaci, aditivně k existující pipeline — answering flow a autosave se nemění, invariant trvá) + kompletní bezpečnostní model relace (bod 13: časové omezení, vazba na dítě a aktivitu, oddělení od rodičovské session, neobnovitelnost přes back, backend ověřuje vše).
Rodinné spuštění: „Spustit pro Matěje" → časově omezená žákovská relace → celoobrazovkový žákovský režim s trvalým pruhem („Režim žáka: Matěj · Spuštěno rodičem · Ukončit") → návrat vyžaduje rodičovské ověření (PIN/heslo). Dítě v relaci nevidí nic rodičovského.
Tři úrovně aktivit (bod 6): procvičování (bez ověření, pomoc OK), domácí úkol (dle nastavení učitele: nic/PIN/potvrzení/kód), klasifikovaný test (učitel volí ze 7 režimů; default konzervativní — princip 4). API doménově omezené: POST /guardian/student-sessions, nikdy generický login-as.
Učitelský pohled na provenance (bod 7): u odevzdání vidí, kdo spustil, jak bylo dítě ověřeno, deklarovanou pomoc — srozumitelně („Test spustil rodič, Matěj nebyl dodatečně ověřen"), ne enum dumpem.
Definition of done: celý scénář rodič → výběr → spuštění → práce dítěte → odevzdání dítěti → audit iniciátora → bezpečný návrat, kryto testovací maticí bodu 19 (všech 8 scénářů).
ETAPA D — Audit, kompletace, dokumentace

Pokrývá body 16, 19 (zbytek), 22.

Auditní záznamy všech guardian událostí (vytvoření/potvrzení/odebrání vztahu, spuštění/ukončení relace, způsob ověření, reset PINu, neoprávněné pokusy). Audit doplňuje doménové vazby, nenahrazuje je.
PIN bezpečnost: hash (nikdy plaintext v DB ani lozích), limit pokusů, reset jen oprávněným rodičem/školou.
docs/guardian.md (architektura, bezpečnostní model, provenance sémantika pro učitele) + finální report s verdiktem za celek.
5. Co je explicitně MIMO rozsah (bod 20 + rozhodnutí)

Biometrie, proctoring, kamera, AI detekce pomoci, scoring důvěryhodnosti, plný chat učitel–rodič, sociální sítě, platby/nákupy v rodičovském UI (přijde s Parťák 2.0 F4), rozsáhlé analytické dashboardy pro rodiče, notifikační kampaně (samostatný projekt po guardianovi — vazba z Etapy B je jeho prerekvizita).

6. Známé kolizní body (řešit u STOPů, ne ad-hoc)
Učitel-rodič v téže organizaci — hlavní důvod Etapy A; návrh musí ukázat, jak se přepíná kontext rolí v navigaci (ne dvě přihlášení).
Věkové režimy v rodičem spuštěné relaci — relace dítěte respektuje jeho ročník (young/old), ne rodiče; ?mode= override v guardian relaci nefunguje.
Individuální parťák v žákovské relaci spuštěné rodičem — dítě SVÉHO parťáka vidí (je to jeho session!), rodič ho nevidí ve svém UI. Pruh režimu žáka nesmí parťáka zakrývat.
Sourozenci na jednom zařízení — ukončení relace musí spolehlivě vyčistit stav (storage, cache) před spuštěním pro druhé dítě; e2e scénář povinný.
Guardian + budoucí notifikace — model vztahu z Etapy B musí nést preference notifikací per rodič-dítě (sloupec připravit, UI až v notifikačním projektu).
7. Metriky úspěchu (po nasazení v pilotu)
Rodič poprvé přihlášený → viděl přehled dítěte: < 60 s, bez podpory.
% rodičů, kteří se po prvním týdnu vrátili (cíl: > 40 %).
0 incidentů typu „výsledek u špatného dítěte" / „rodič viděl cizí dítě".
Učitelé rozumí provenance bez školení (ověřit rozhovorem s 3 kolegy).

Původní specifikace zůstává přílohou tohoto dokumentu a platí v plném rozsahu tam, kde ji tento dokument výslovně nemění (parťák, sociální sítě, pořadí etap).

Project content
SkillStorm
Created by you
Add PDFs, documents, or other text to reference in this project.
Content

Notion × Duolingo — Friendly Education SaaS Remix. Notion's warm neutral document surface + Duolingo's saturated greens, rounded corners, and tactile feedback. For learning platforms, courses, and education tools that want to feel like a serious workspace and a friendly tutor at once. Parent DNA: N

PASTED

Přečtu si design prototyp a projdu strukturu projektu. Read 8 files, ran 10 commands Mám načtený design prototyp i strukturu projektu. Tady je plán migrace. Plán migrace: Notion × Duolingo design systém Co design definuje Prototyp (design-reference.jsx) obsahuje: tokeny (teplé Notion neutrály #fb

PASTED

excerpt_from_previous_claude_message.txt

1 line

TXT

Grade se odvozuje z ACTIVE enrollmentu — přesně jak zadání chce. Zkontroluji typy otázek a pak napíšu seed: Teď zjistím, co klient posílá jako givenText pro MC (id vs text): Mám vše potřebné. Píšu scénářový seed: Username je globálně unikátní a wipe ho nestíhá — udělám username náhodný (email zůs

PASTED

excerpt_from_previous_claude_message.txt

1 line

TXT

Návrh: Bleskovky (live sessions) 1. Klíčové rozhodnutí: „sada otázek" = existující Test Question má povinnou vazbu testId a celý builder nad ní stojí. Nejmenší možný refactor je žádný refactor: Bleskovka odkazuje na Test (publikovaný, s otázkami typu MULTIPLE_CHOICE/TRUE_FALSE). „Vlastní sada" = uči

PASTED

1. Campaign = obsah, ne tabulka Žádný DB model Campaign. Definice kampaně je JSON v server/content/campaigns/*.json (musí být v server/, protože CI bootuje z dist — nest-cli je zkopíruje jako asset). Server je načte při bootu přes CampaignContentService se zod validací a fail-fastem. Přidat kampaň =

PASTED

Pustím se do toho. Nejdřív si načtu paměť k Bleskovkám a zjistím stav repa, ať víme, odkud větvit. Teď testy, scénáře a docs, ať vím, co rozšiřuji. Mám kompletní obraz. Založím plán a pustím se do implementace. Postgres běží. Upravím schéma a vytvořím migraci. Migrace `20260719154216_add_round_v

PASTED

Rozumím — nejdřív prozkoumám stávající model Bleskovek (Prisma schéma, snapshoty kol, builder), pak navrhnu model pro interactionType a zastavím se na schválení Bloku 1. Základna je připravená — větev `feature/board-interactions` jsem založil nad `feature/board-voting` (hlasování ještě není v mainu

PASTED

# SkillStorm – zjednodušení rodičovského prostředí a rodinné spuštění žákovských aktivit Proveď analýzu a následnou implementaci zjednodušeného rodičovského prostředí v aplikaci SkillStorm. Cílem není pouze graficky upravit rodičovský dashboard. Je potřeba vyřešit celý uživatelský, bezpečnostní a

PASTED