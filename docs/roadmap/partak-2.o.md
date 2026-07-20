Parťák 2.0 — Roadmapa

Status: návrh k zařazení do fronty · Pořadí: až po guardian etapách a ostrém pilotu Vlastník: Profesor · Poslední úprava: červenec 2026

Vize

Parťák se z jednoho přiděleného maskota stává mazlíčkem, kterého si dítě vybralo, vychovalo a je na něj hrdé — a kolem kterého existuje sběratelská vrstva (album, samolepky) a volitelná vrstva hmotných odměn (skutečné samolepky, plyšáci), kterou platí dospělí, nikdy děti.

Cíl není víc gamifikace. Cíl je hlubší vztah dítěte k vlastnímu pokroku — a druhý příjmový kanál, který učitelé a rodiče budou mít rádi, protože nekupuje výhody, ale památky.

Červené čáry (neporušitelné, platí pro každou fázi)

Tyto principy jsou vynucené konstrukcí systému, ne disciplínou — stejně jako dnes:

XP se nikdy neprodává ani nekupuje. Žádná mikrotransakce nemění XP, úroveň, postup kampaně ani cokoli herního.
Žádný druh mazlíčka nemá herní výhodu. Volba je čistě vizuální a emocionální. Neexistuje „správná volba".
Systém nikdy nesrovnává děti. Neexistuje obrazovka, endpoint ani export, kde by kdokoli viděl úrovně/parťáky více dětí vedle sebe. Chlubení je akt dítěte (ukáže album na svém zařízení), nikdy stav systému.
Parťák zůstává neviditelný pro učitele, ředitele i rodiče (u rodičů viz volitelné „momenty" — bez čísel, bez úrovní; rozhodnutí po pilotu).
Odměny rostou z účasti a snahy, ne ze správnosti. Beze změny — album, evoluce i fyzické odměny se váží na milníky účasti (dokončené výpravy, série, evoluce), nikdy na skóre.
Fyzické zboží objednává a platí výhradně dospělý (učitel za třídu, rodič za dítě). Dítě nikdy nevidí ceny, košík ani výzvu k nákupu. Žádný dark pattern („řekni mamince…") — impulz musí přijít od dospělého.
Fáze 1 — Výběr mazlíčka (základ všeho)

Co: Při prvním přihlášení (a jednorázově pro stávající žáky) si dítě vybere jednoho ze 3–4 druhů parťáka. Volba je trvalá — mazlíček není spotřební zboží, je to vztah.

Druhy (návrh, finální podoba s ilustrátorem):

Druh	Charakter	Finální forma (tajná!)
Dráček	odvážný, ohnivý	majestátní drak
Sova	zvědavá, moudrá	velká sova-strážce
Liška	hravá, mazaná	stříbrná liška
Kočka	klidná, svá	velká kočkovitá šelma

Klíčová pravidla:

Výběr ukazuje jen mláďata — finální evoluce je tajemství (objevování je háček, viz Fáze 2).
Stávající žáci: jednorázová volba s tím, že XP a postup se plně zachovají (parťák se „převtělí").
Druh je kosmetický atribut na profilu žáka; veškerá XP/stage logika zůstává beze změny.

Technicky: Student.partakSpecies (enum), sada SVG per druh × stage, migrace aditivní. Výběrová obrazovka ve stylu design systému (young/old varianty dle věkového režimu).

Hotovo znamená: dítě si vybralo, parťák se zobrazuje ve zvoleném druhu ve všech existujících místech (dashboard, testy, výpravy), e2e ověřuje, že druh nemá žádný vliv na XP/postup.

---## Fáze 2 — Evoluční řady („od malého kreténa po tygra")

Co: Každý druh má vlastní vývojovou řadu přes existujících 5 stage — s výrazným obloukem od neohrabaného mrněte po majestátní formu. Stage logika (prahy XP) se nemění, mění se jen vizuál a dramaturgie.

Dramaturgie evoluce (to hlavní):

Evoluce je událost: celoobrazovková animace „?!" → proměna → nová forma, jednou, neopakovatelně (ale přehratelná z alba).
Silueta další formy je vidět v profilu parťáka jako stín s otazníkem — „v co vyrosteš?" je tichý motor návratů.
Věkový režim platí: u starších je evoluce střízlivější (emblém se „vylepší" — nová heraldika), žádná dětinská scéna na gymplu.

Technicky: žádná změna datového modelu (stage existuje), jen asset sady per druh × stage + animační scéna + záznam evoluce do alba (Fáze 3).

Hotovo znamená: všechny druhy mají kompletní řady v obou věkových tónech, evoluce se přehraje jednou a zapíše do alba, XP prahy netknuté.

Fáze 3 — Sběratelské album (chlubení jako akt dítěte)

Co: Soukromé album žáka — jediné místo, kde se sbírá a vzpomíná. Dítě ho může komukoli samo ukázat (na svém zařízení, doma, o přestávce), ale neexistuje žádné systémové sdílení, feed ani srovnání.

Co se do alba sbírá (vše za účast a milníky, nic za skóre):

Samolepky z výprav — už existují jako CampaignStepUnlock; album je zpřístupní žákovi (dnes je vidí jen třída na projekci).
Evoluční karty — záznam každé proměny parťáka (datum, forma), s možností přehrát animaci.
Milníkové samolepky — první dokončený test, série 5/10/30 dní, dokončená výprava, dokončená mise, X odehraných bleskovek. Katalog milníků jako obsahová data (JSON, stejná filozofie jako kampaně — přidat samolepku = přidat soubor).
Sezónní/příležitostné — začátek školního roku, Vánoce apod. (volitelné, obsahová práce).

Explicitně NE:

Žádná samolepka typu „100 % v testu", „nejlepší ve třídě", „rychlejší než ostatní".
Žádný počet samolepek viditelný komukoli jinému, žádný „progress" alba jako metrika.

Technicky: StickerAward (studentId, stickerKey, sourceType, sourceId?, awardedAt) — aditivní, idempotentní (unique na student+sticker), zpětné přiznání za existující historii (dokončené výpravy, streaky) jednorázovým skriptem. Album UI ve stylu design systému, young/old tón.

Hotovo znamená: album žije, plní se automaticky z existujících událostí, obsahuje historii, e2e ověřuje idempotenci a že žádný endpoint nevrací alba cizích dětí.

Fáze 4 — Hmotné odměny („krabice") — business vrstva

Co: Fyzické zboží navázané na skutečné milníky — platí a objednává výhradně dospělý. Dítě dostává hmotnou památku na skutečný pokrok; nikdo nekupuje nic herního.

Produkty (od nejjednoduššího):

Arch samolepek výpravy — po dokončení výpravy může učitel objednat skutečné samolepky (ty z mapy) pro třídní album/děti. Nízká cena, objednávka po třídách, přirozený rituál zakončení výpravy.
Evoluce jako kartičky — sada karet vývojové řady parťáka; rodič může objednat po dosažení finální formy.
Plyšák parťáka — prémiová položka; rodič, typicky po finální evoluci nebo k vysvědčení. (Výroba na poptávku / předobjednávky — neřešit sklad dřív, než je poptávka ověřená.)
Třídní diplom výpravy — tisknutelné zdarma (marketing), fyzicky poslané za poplatek.

Pravidla (rozšíření červených čar):

Nabídka se zobrazuje jen dospělým v jejich rozhraních (učitelský souhrn výpravy, rodičovský prostor). V žákovském UI neexistuje.
Žádná časová nátlaková mechanika („jen do pátku!").
Objednávkový tok může být v MVP polomanuální (formulář → e-mail → ruční vyřízení) — neinvestovat do e-shop infrastruktury před ověřením poptávky.

Předpoklady: dokončený guardian projekt (rodičovské rozhraní existuje), ilustrace v kvalitě pro tisk, dodavatel tisku/výroby, právní minimum (obchodní podmínky, DPH).

Hotovo znamená: učitel dokáže objednat arch samolepek po výpravě, rodič kartičky/plyšáka po evoluci, dítě o obchodě neví, první reálné objednávky proběhly.

Pořadí a závislosti
(teď) guardian etapy A–D  →  ostrý pilot  →  zpětná vazba dětí
                                                │
Fáze 1 Výběr mazlíčka  ◄────────────────────────┘
Fáze 2 Evoluční řady   (hned po F1 — sdílí assety)
Fáze 3 Album           (nezávislá na F1/F2 datově, ale emočně navazuje)
Fáze 4 Krabice         (vyžaduje guardian UI + ověřenou poptávku z pilotu)
F1+F2 jsou jeden ilustrační projekt — 4 druhy × 5 stage × 2 věkové tóny je ~40 assetů; to je největší nákladová položka celé roadmapy a jediná, kterou nejde „naklikat". Zvážit profesionálního ilustrátora — kvalita mazlíčků je tvář produktu.
F3 jde technicky udělat kdykoli (staví na existujících datech), ale největší efekt má s novými druhy.
F4 nezačínat před pilotem — poptávku po plyšácích ověří jedna věta v dotazníku pro rodiče, ne investice do výroby.
Co pilot musí zodpovědět, než se F1 spustí
Chlubí se děti parťákem samy? (→ potvrzuje princip „sdílení je akt dítěte")
Mluví o něm doma? (→ vstup pro rozhodnutí o rodičovských „momentech")
Která věková skupina na parťáka reaguje nejsilněji? (→ prioritizace assetů)
Ptají se děti „co bude dál" u evoluce? (→ validace tajných forem)
Zeptal se některý rodič/učitel sám od sebe na fyzické samolepky? (→ signál pro F4)

Dokument patří do docs/roadmap/partak-2.0.md. Při zařazení do vývoje každou fázi rozpracovat do zadání se STOP checkpointy dle zavedeného procesu.

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