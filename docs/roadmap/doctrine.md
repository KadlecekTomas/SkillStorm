# THE SKILLSTORM DOCTRINE

## Zakladatelská doktrína pro vybudování evropské vzdělávací infrastruktury

**Verze:** 0.1 — Founding Evidence Baseline  
**Datum:** 21. 7. 2026  
**Status:** Živý strategický dokument — závazný pro produktová rozhodnutí, nikoli nedotknutelné dogma  
**Vlastníci:** zakladatelé SkillStormu  
**Nadřazenost dokumentů:** `DOCTRINE.md` → `STRATEGY.md` → `MASTER.md` → projektové roadmapy → implementační zadání

---

> **Nechceme postavit další aplikaci, kterou škola otevře jednou týdně.**
>
> Chceme vybudovat bezpečnou inteligentní vrstvu, která propojí každodenní práci školy, odstraní opakovanou administrativu, posílí učitele a pomůže každému dítěti dostat včas správnou podporu.
>
> SkillStorm nebude vítězit počtem funkcí. Bude vítězit množstvím práce, kterou škola už nemusí dělat ručně.

---

# 0. Jak tento dokument číst

Tento dokument není:

- marketingová prezentace,
- seznam funkcí,
- obchodní plán založený na přáních,
- omluva pro nekonečný vývoj,
- tvrzení, že technologie sama opraví školství.

Tento dokument je:

1. **mapa reality**, kterou je nutné ověřovat daty;
2. **soustava strategických sázek**, které mohou být vyvráceny;
3. **produktová ústava**, která omezuje chaos a feature creep;
4. **výzkumný plán**, podle něhož budeme měřit skutečnou hodnotu;
5. **filtr kapitálu a času**, který má zabránit stavění věcí s nízkou návratností.

Každé významné tvrzení je v Doctrine zařazeno do jedné ze čtyř tříd:

| Značka | Význam | Jak s tvrzením pracujeme |
|---|---|---|
| **Fakt** | Podloženo důvěryhodným zdrojem nebo našimi provozními daty | Lze použít jako základ rozhodnutí, ale sledujeme stáří a kontext |
| **Inference** | Logický závěr odvozený z více faktů | Musí být explicitně označen a zpochybnitelný |
| **Hypotéza** | Neověřený předpoklad, který je nutné testovat | Bez pilotního důkazu nesmí ospravedlnit velkou investici |
| **Rozhodnutí** | Vědomá strategická volba zakladatelů | Platí, dokud není změněna na základě nových důkazů |

## 0.1 Důkazní standard

Hierarchie zdrojů:

1. naše anonymizovaná produktová a pilotní data;
2. primární veřejná data a regulace;
3. OECD, UNESCO, Eurostat, Evropská komise, MŠMT, ČSÚ;
4. systematické přehledy a nezávislé evaluace;
5. zákaznické rozhovory a pozorování;
6. veřejná tvrzení konkurence;
7. názory, sociální sítě a marketing.

Veřejné tvrzení konkurenta o počtu uživatelů není totéž jako auditované MAU, počet platících škol, retence nebo tržní podíl. V Doctrine se taková čísla používají jen s jasnou výhradou.

## 0.2 Pravidlo změny názoru

Když realita odporuje Doctrine, **mění se Doctrine, ne realita**.

Zakladatel nesmí bránit starou myšlenku jen proto, že:

- ji vyslovil veřejně,
- už do ní vložil vývojový čas,
- vypadá dobře v demu,
- konkurence ji má,
- by bylo psychologicky nepříjemné ji zrušit.

Sunk cost není argument. Roadmapa je nástroj, nikoli identita.

---

# 1. Zakladatelská teze

## 1.1 Problém škol není nedostatek aplikací

Školy už dnes mají e-mail, cloudové úložiště, kancelářský balík, LMS, školní informační systém, katalog digitálního obsahu, nástroje pro kvízy a množství lokálních tabulek a dokumentů.

Přesto se opakují čtyři strukturální problémy:

1. **fragmentace** — data, úkoly a komunikace jsou rozdělené mezi více systémů;
2. **duplicitní práce** — stejná informace se zadává, kontroluje nebo přepisuje opakovaně;
3. **nízká kontextovost** — nástroje znají jednotlivý dokument nebo test, ale ne celý proces výuky;
4. **slabá zpětná vazba** — škola často ví, co bylo zadáno, ale neví včas, kdo potřebuje pomoc a jakou.

Evropská komise výslovně označuje fragmentaci digitálního vzdělávání a potřebu interoperability za problém, který je nutné řešit společnými rámci a standardy.[^eu-hub][^eu-interoperability]

## 1.2 Učitelé nepotřebují „více AI“. Potřebují méně zbytečné práce

TALIS 2024 zahrnul 280 000 pedagogů v 55 vzdělávacích systémech.[^talis-main] Učitelé v průměru tráví nejvíce času výukou a přípravou; administrativa tvoří menší absolutní podíl, ale další hodiny administrativy, opravování a komunikace s rodiči jsou spojeny s výraznějším poklesem profesní pohody než další hodiny některých jiných činností.[^talis-demands][^talis-thriving]

Pro Česko OECD uvádí, že nadměrná administrativa zůstává významným zdrojem pracovního stresu přibližně pro polovinu učitelů.[^talis-cz]

**Inference:** Nejvyšší produktová hodnota pravděpodobně nevznikne automatizací jedné izolované obrazovky, ale odstraněním celého opakujícího se workflow, které přerušuje práci učitele.

## 1.3 Technologie je užitečná pouze tehdy, když zlepšuje pedagogiku nebo odstraňuje tření

DigCompEdu popisuje digitální kompetence učitele v 22 kompetencích a šesti oblastech. Nejde jen o používání nástrojů, ale o profesionální zapojení, digitální zdroje, výuku, hodnocení, podporu žáků a rozvoj jejich digitálních kompetencí.[^digcompedu]

Education Endowment Foundation upozorňuje, že digitální technologie nejsou samy o sobě pedagogickou intervencí. Smysl mají tehdy, když podporují účinné postupy, například kvalitní zpětnou vazbu, metakognici, formativní hodnocení nebo cílenou podporu.[^eef-feedback][^eef-metacognition][^eef-edtech]

**Rozhodnutí:** SkillStorm nebude optimalizovat „čas na obrazovce“, počet kliknutí ani počet vytvořených AI artefaktů. Bude optimalizovat odstraněnou práci, kvalitu zpětné vazby a schopnost učitele jednat včas.

## 1.4 AI není autorita. Je levná výrobní a koordinační kapacita pod lidskou kontrolou

UNESCO doporučuje human-centred přístup ke generativní AI, ochranu dat, věkovou přiměřenost, transparentnost a zachování lidské odpovědnosti.[^unesco-genai][^unesco-ai-policy]

Evropský AI Act používá rizikově orientovaný rámec. Některé aplikace AI ve vzdělávání mohou spadat do vysoce rizikových kategorií, zejména pokud ovlivňují přístup ke vzdělání nebo zásadní hodnocení osob.[^ai-act]

**Rozhodnutí:** SkillStorm smí využívat AI pro návrhy, sumarizaci, přípravu, překlady, vysvětlení, doporučení a detekci pracovních signálů. Konečná pedagogická rozhodnutí, disciplinární rozhodnutí, zásadní klasifikace a rozhodnutí s významným dopadem na dítě zůstávají pod smysluplnou lidskou kontrolou.

---

# 2. Kategorie, kterou budujeme

## 2.1 Pracovní název kategorie

> **School Intelligence & Workflow Layer**

Český pracovní překlad:

> **Inteligentní provozní a pedagogická vrstva školy**

„AI Operating System for Schools“ je silné interní vyjádření ambice, ale nesmí předstírat, že SkillStorm nahradí všechny systémy školy. To by bylo nevěrohodné, kapitálově destruktivní a strategicky chybné.

## 2.2 Co SkillStorm nahrazuje a co nenahrazuje

### Nenahrazujeme automaticky

- Google Workspace nebo Microsoft 365;
- e-mail, dokumenty, kalendář a cloudové úložiště;
- školní matriku a zákonné výkaznictví;
- zavedený SIS tam, kde funguje;
- lidský úsudek učitele;
- kvalitní obsah jen proto, že umíme něco vygenerovat;
- osobní vztah školy, dítěte a rodiny.

### Nahrazujeme nebo odstraňujeme

- opakované přepisování údajů;
- ruční zakládání duplicitních tříd a účtů;
- nekontextové rozesílání stejných zpráv;
- ruční sledování, kdo přečetl, odevzdal nebo potřebuje připomenutí;
- ruční tvorbu prvního návrhu rutinních materiálů;
- izolované výsledky bez následného kroku;
- informační slepá místa mezi zadáním, učením, výsledkem a podporou.

## 2.3 Centrální produktová smyčka

```text
KONTEXT ŠKOLY
uživatelé · role · třídy · předměty · ročník · cíle · preference
        ↓
UDÁLOST
test zadán · úkol odevzdán · termín se blíží · žák tápe · rodič nepotvrdil
        ↓
ROZHODOVACÍ VRSTVA
pravidlo · oprávnění · pedagogický kontext · riziko · lidské schválení
        ↓
AKCE
zpětná vazba · připomínka · doporučení · přehled · eskalace · synchronizace
        ↓
DŮKAZ
doručeno · přečteno · splněno · změna výsledku · ušetřený čas
        ↓
UČENÍ SYSTÉMU
lepší šablona · přesnější workflow · méně ruční práce · lepší podpora
```

To je jádro SkillStormu. Test, kvíz, materiál, parťák, oznámení ani AI nejsou samostatným produktem. Jsou uzly této smyčky.

---

# 3. Jedna věta, kterou musíme umět obhájit

## 3.1 Pro učitele

> SkillStorm propojí třídy, materiály, testování a komunikaci tak, aby učitel zadával informace jednou a opakující se práce proběhla automaticky pod jeho kontrolou.

## 3.2 Pro ředitele

> SkillStorm škole vrací čas, sjednocuje pedagogická workflow nad stávající infrastrukturou a dává vedení důkaz, že úkoly, informace a podpora skutečně doputovaly tam, kam měly.

## 3.3 Pro rodiče

> SkillStorm vás upozorní jen na to, co je pro vaše dítě důležité, ve srozumitelném jazyce a s jasnou akcí.

## 3.4 Pro žáka

> SkillStorm ti ukáže, co máš dělat dál, vysvětlí chybu bez ponižování a porovnává tě především s tvým vlastním pokrokem.

## 3.5 Zakázaná věta

> „Máme všechno v jedné aplikaci.“

Tato věta je nedůvěryhodná. Každá škola bude dál používat infrastrukturu třetích stran. Naší výhodou není izolace, ale kontextová orchestrace.

---

# 4. Tvrdé produktové principy

## P1 — Jedna informace se zadává maximálně jednou

Nejprve import, synchronizace nebo odvození. Ruční vstup až jako poslední možnost.

**Test:** Vyžaduje workflow údaj, který již existuje v Google Workspace, Microsoft 365, SIS, předchozím zadání nebo školním kalendáři?

## P2 — Automatizujeme proces, ne odpovědnost

Systém může připravit, rozeslat, připomenout a sumarizovat. Nemůže se stát neviditelným rozhodovatelem o dítěti.

## P3 — Každá automatizace musí být vysvětlitelná

Uživatel musí vědět:

- proč se akce spustila,
- z jakých dat vychází,
- kdo ji nastavil,
- jak ji zastavit,
- kdo nese odpovědnost.

## P4 — Výchozí stav je bezpečný a úsporný na pozornost

Žádný nekonečný feed. Žádné engagement dark patterns. Žádné zbytečné notifikace.

## P5 — Dítě není zdroj růstových metrik

Neoptimalizujeme závislost, tlak ani sociální srovnávání. Odměňujeme účast, úsilí, pravidelnost a osobní pokrok, nikoli veřejnou hierarchii výkonu.

## P6 — Rodičovská komunikace je účelová, nikoli společenská síť

Zpráva má kontext, důvod, termín a případnou akci. Potvrzení přečtení není totéž jako souhlas nebo splnění.

## P7 — Pedagogika před generováním

AI artefakt bez cíle, zdroje, věkové přiměřenosti a učitelské kontroly je levný obsah, ne kvalitní výuka.

## P8 — Interoperabilita je produktová vlastnost, ne technický detail

LTI propojuje vzdělávací nástroje s prostředím instituce; OneRoster standardizuje bezpečnou výměnu tříd, uživatelů, kurzů a známek.[^lti][^oneroster]

SkillStorm bude architektonicky připraven na:

- standardizované identity a role;
- roster sync;
- import/export;
- event-driven integrace;
- auditovatelný provenance model;
- postupnou podporu LTI 1.3, OneRoster a relevantních evropských standardů.

## P9 — Data patří škole a dítěti v rámci zákona, ne našemu růstovému týmu

GDPR vyžaduje zvláštní ochranu osobních údajů dětí.[^gdpr][^bik]

Výchozí principy:

- minimalizace dat;
- EU hosting pro evropské školy;
- oddělené tenanty;
- audit přístupů;
- retenční pravidla;
- exportovatelnost;
- smazání a anonymizace;
- zákaz sekundárního marketingového využití dětských dat.

## P10 — Žádný lock-in založený na rukojmích

Škola musí mít možnost exportovat důležitá data ve strojově čitelném formátu. Retenci budujeme hodnotou a workflow, ne zadržováním informací.

## P11 — Učitel musí získat hodnotu před školním tendrem

Freemium nástroj pro učitele je distribuční motor. Školní vrstva je bezpečnostní, integrační, analytická a provozní infrastruktura.

## P12 — Ředitel kupuje důkaz, ne slib

Musíme umět ukázat:

- kolik času se ušetřilo;
- kolik workflow proběhlo bez ručního přepisu;
- kolik relevantních příjemců informaci převzalo;
- kde se snížil počet nedokončených kroků;
- zda pedagogický výsledek zůstal stejný nebo se zlepšil.

## P13 — Pilotní data mají přednost před zakladatelskou intuicí

Tři nadšení učitelé nejsou důkaz product-market fit. Jedna vlastní škola není reprezentativní trh.

## P14 — Nejsme ERP všeho

Každá nová provozní oblast musí projít testem:

1. Je těsně spojená s výukou, podporou nebo školním workflow?
2. Umíme ji integrovat lépe, než ji kompletně nahradit?
3. Přinese měřitelnou úsporu nebo lepší rozhodnutí?
4. Nevytváří právní a provozní závazek neúměrný hodnotě?

## P15 — Růst nesmí předběhnout bezpečnost

Dětská data, role rodič–dítě, školní komunikace a automatické doporučování jsou citlivější než běžný B2C SaaS. Bezpečnost není položka po launchi.

---

# 5. Realita trhu: Česko

## 5.1 Velikost českého vstupního pole

Ve školním roce 2025/26 bylo na českých základních školách zapsáno téměř 1,003 milionu žáků.[^cz-pupils] V roce 2023/24 působilo na základních školách přibližně 74 982 učitelských úvazků.[^cz-teachers]

To je dostatečně velký trh pro vybudování významné firmy, ale ne dostatečně velký pro dlouhodobou globální ambici bez expanze nebo širšího produktového záběru.

## 5.2 České specifikum jako výhoda

Česko je dobrý beachhead, protože:

- zakladatel rozumí školní realitě zevnitř;
- lze rychle provést vlastní pilot;
- zpětná vazba může být v mateřském jazyce;
- reference jsou dosažitelné bez drahé mezinárodní distribuce;
- trh je dost malý na mapování a dost velký na ověření B2B modelu.

Česko však nesmí vytvořit produktovou klec. Datový model, workflow engine a integrační vrstva nesmějí být pevně svázány s jedinou terminologií, školním systémem nebo českým kurikulem.

## 5.3 Co znamená „ovládnout české školství“

Neznamená to:

- monopol;
- nahrazení MŠMT;
- vytlačení všech SIS a LMS;
- přimět každou školu používat všechny moduly;
- vyhrát marketingovou soutěž.

Pracovní definice:

> SkillStorm se stane výchozí inteligentní workflow vrstvou pro významnou část českých škol a nástrojem, který učitelé otevírají pravidelně, protože odstraňuje práci a propojuje to, co už používají.

Měřitelné milníky:

| Fáze | Důkaz |
|---|---|
| 1 | 3 pilotní školy používají stejný hlavní workflow bez zakladatele v místnosti |
| 2 | 10 škol obnoví placenou licenci |
| 3 | alespoň 50 % aktivních učitelů ve škole používá produkt týdně |
| 4 | škola prokazatelně ušetří čas v alespoň dvou procesech |
| 5 | referral mezi řediteli nebo učiteli tvoří významný podíl pipeline |
| 6 | integrace a onboarding fungují bez ručních zásahů zakladatele |
| 7 | produkt je přenositelný na druhý národní trh |

---

# 6. Realita trhu: Evropa a svět

## 6.1 Evropa není jeden trh

Evropa má společné regulační a datové principy, ale rozdílné:

- kurikulum;
- jazyk;
- financování škol;
- roli obcí, krajů a státu;
- SIS a identity;
- rozhodovací pravomoci ředitelů;
- kulturu rodičovské komunikace;
- veřejné zakázky;
- digitální zralost.

Proto neexistuje „přeložit do angličtiny a expandovat“.

## 6.2 Velikost evropské příležitosti

V EU v roce 2023 pracovalo v primárním a sekundárním vzdělávání přibližně 5,26 milionu učitelů.[^eu-teachers] V roce 2024 bylo v primárním vzdělávání 23,2 milionu žáků.[^eu-primary]

To nevytváří automaticky trh pro SkillStorm. Vytváří to pouze velký počet potenciálních uživatelů. Skutečný adresovatelný trh vznikne až kombinací:

- rozhodovací pravomoci školy;
- kompatibilní infrastruktury;
- ochoty platit;
- naléhavé bolesti;
- realistických akvizičních nákladů;
- regulatorní a jazykové obslužnosti.

## 6.3 Standardy jsou exportní strategie

Microsoft School Data Sync ukazuje, že velcí hráči automatizují uživatele, třídy a role přes SIS, CSV a OneRoster.[^ms-sds] Google Classroom nabízí úkoly, analytiku, známkování a sdílení výukového obsahu.[^google-classroom]

**Inference:** Samotný Google login, import žáků nebo vytvoření třídy není mezinárodní moat. Je to hygienický základ.

Exportovatelnou hodnotou SkillStormu musí být:

1. workflow engine;
2. kontextová automatizace;
3. permission a provenance model;
4. pedagogicky bezpečná AI;
5. měření úspory času a dokončení procesů;
6. lokálně adaptovatelné šablony;
7. integrace přes standardy.

## 6.4 Pořadí expanze

### Fáze A — Česko

Cíl: potvrdit problém, workflow a ekonomiku nasazení.

### Fáze B — Slovensko

Důvod: jazyková a kulturní blízkost, možnost otestovat, zda produkt není nevědomě svázán s českými procesy.

### Fáze C — jeden vybraný evropský trh

Trh nebude vybrán podle velikosti ega, ale podle skóre:

| Kritérium | Váha |
|---|---:|
| Naléhavost řešeného workflow | 20 % |
| Decentralizované nákupní rozhodování | 15 % |
| Penetrace Google/Microsoft infrastruktury | 15 % |
| Otevřenost SIS a standardů | 15 % |
| Cena lokalizace a podpory | 10 % |
| Regulatorní kompatibilita | 10 % |
| Dostupný lokální partner/distribuce | 10 % |
| Platební schopnost | 5 % |

### Fáze D — regionální platforma

Až po důkazu:

- retence přes dva školní roky;
- opakovatelný onboarding;
- lokální partner channel;
- standardizované integrační rozhraní;
- bezpečnostní a právní balíček;
- unit economics bez zakladatelské ruční práce.

---

# 7. Konkurenční realita

## 7.1 Pět kategorií konkurence

| Kategorie | Příklady | Co zákazník kupuje |
|---|---|---|
| Obsah a procvičování | UmímeTo, vydavatelé | hotový obsah, procvičování, doporučování |
| Tvorba a engagement | ForClassmates, Kahoot, Quizizz | materiály, prezentace, kvízy, aktivizace |
| LMS a spolupráce | Google Classroom, Moodle, Teams | zadávání, distribuce, spolupráce |
| SIS a provoz | Bakaláři, EduPage, lokální systémy | matrika, známky, rozvrh, zákonné/provozní procesy |
| Horizontální AI | Gemini, Copilot, ChatGPT | generování, analýza, asistence |

SkillStorm nesmí vyhrát všech pět kategorií. Musí být vrstvou, která přes ně zajišťuje konkrétní workflow a přidává školní kontext.

## 7.2 ForClassmates: skutečná hrozba bez paniky

Veřejná prezentace ForClassmates ukazuje platformu zaměřenou na kurzy, prezentace, kvízy, interaktivní obsah, AI kredity, gamifikaci a tvorbu obsahu.[^forclassmates-home]

Firma veřejně uvádí přibližně 150 000 uživatelů/studentů a více než 300 škol používajících její metodiku nebo materiály.[^forclassmates-claim][^forclassmates-schools] Zdroje jsou však primárně firemní marketing a nepublikují:

- měsíční aktivní uživatele;
- počet platících škol platformy;
- retenci;
- příjmy;
- podíl Česko vs. Slovensko;
- podíl učebnic vs. digitální platformy;
- hloubku nasazení v jednotlivých školách.

Proto nelze z čísla 150 000 korektně vypočítat tržní podíl.

### Co je na ForClassmates silné

- více než deset let budovaná značka;
- původ v konkrétním obsahu a učebnicích;
- existující distribuce do škol;
- schopnost monetizovat jednotlivce;
- obsahová výrobní zkušenost;
- veřejná ambice expandovat;
- náskok v počtu vytvořených materiálů a vztazích.

### Co z veřejného produktu není prokázáno

- že je dominantní každodenní provozní vrstvou školy;
- že automatizuje end-to-end školní workflow;
- že má hluboké identity, guardian, audit a interoperabilní orchestration jádro;
- že deklarovaných 150 000 představuje současné platící nebo pravidelně aktivní uživatele.

### Verdikt hrozby

> **ForClassmates je relevantní a financovaná konkurence v obsahu, tvorbě a engagementu. Není veřejně prokázáno, že vlastní kategorii školního workflow.**

Pro SkillStorm by bylo špatně, kdyby:

- kopíroval jejich prezentace, kurzy a AI kredity;
- soutěžil množstvím obsahu bez distribuční výhody;
- podcenil jejich schopnost přidat nové funkce;
- stavěl odlišnost pouze na UI nebo generativní AI.

Pro SkillStorm je přijatelné, když:

- ForClassmates zůstane silnější ve výrobě samostatného obsahu;
- SkillStorm bude výrazně silnější v kontextu školy, workflow, integracích, guardian vazbách, auditovatelnosti a automatizaci následných kroků.

## 7.3 Google a Microsoft jsou větší strategická hrozba než lokální funkční konkurent

Google Classroom už nabízí workflow úkolů, grading, analytiku a sdílení výuky.[^google-classroom] Microsoft automatizuje roster, identity, třídy, role a guardian data pomocí School Data Sync.[^ms-sds][^ms-guardian]

To znamená:

- cloudová integrace není moat;
- „vše v jednom“ proti platformám nedává smysl;
- generický AI asistent bude komodita;
- SkillStorm musí vlastnit lokální kontext, orchestration a měřitelnou úsporu.

Naší obranou není bojovat s platformami. Naší obranou je být pro ně užitečnou, standardizovanou a školsky specifickou inteligentní vrstvou.

---

# 8. Produktový wedge: čím začínáme

## 8.1 Wedge není celá vize

Vize může být velká. Vstupní produkt musí být úzký.

Nejlepší kandidát na wedge splňuje pět podmínek:

1. bolest se opakuje minimálně týdně;
2. hodnotu pozná učitel bez dlouhého školení;
3. řešení využije existující školní kontext;
4. vzniká přirozený důvod pozvat třídu, kolegu nebo vedení;
5. výsledek lze změřit.

## 8.2 Aktuální kandidát

> **Od zadání aktivity k dokončenému následnému kroku bez ručního přepisování.**

Příklad:

1. učitel vytvoří nebo zvolí aktivitu;
2. přiřadí ji třídě;
3. systém použije existující roster;
4. žáci dostanou správný přístup;
5. učitel vidí průběh;
6. rodič dostane pouze nastavené relevantní oznámení;
7. chybějící krok se připomene jen správným osobám;
8. výsledek vytvoří doporučení nebo následnou aktivitu;
9. vedení vidí agregovaný provozní důkaz, ne individuální šmírování.

Bleskovky, testy, guardian a notifikace do tohoto wedge zapadají. Každá vertikála ale musí posílit jednu souvislou smyčku, nikoli vytvořit ostrov.

## 8.3 Co zatím není wedge

- marketplace;
- obecný chat;
- kompletní přijímačková příprava;
- plný náhradník Bakalářů;
- autonomní AI sekretář;
- globální knihovna všech předmětů;
- komplikovaný systém plateb školních akcí.

Tyto oblasti mohou být strategicky cenné, ale před product-market fit rozmělňují důkaz.

---

# 9. Čas jako hlavní ekonomická jednotka

## 9.1 North Star Metric

> **Verified Teacher Hours Returned (VTHR)**  
> Ověřené hodiny vrácené učitelům.

Nejde o marketingový odhad typu „jedno kliknutí = pět minut“. Časová úspora musí být vypočtena z:

- baseline pozorování;
- počtu skutečně dokončených workflow;
- mediánu času před a po;
- odečtení nově vzniklé práce;
- korekce na chybovost a dohled;
- pravidelné revalidace.

## 9.2 Doplňkové metriky

### Učitel

- time-to-first-value;
- týdenní aktivace konkrétního workflow;
- podíl dokončených procesů bez ručního zásahu;
- čas na přípravu;
- čas na opravování;
- čas na komunikaci;
- počet duplicitních vstupů;
- subjektivní kognitivní zátěž.

### Škola

- onboarding time;
- počet opravených synchronizačních výjimek;
- doručení a přečtení relevantních oznámení;
- počet chybějících akcí po termínu;
- support tickets na 100 uživatelů;
- aktivace učitelů;
- roční obnova licence;
- počet pracovních postupů používaných napříč školou.

### Žák

- dokončení;
- četnost včasné zpětné vazby;
- osobní pokrok;
- schopnost určit další krok;
- bezpečnostní incidenty;
- nechtěný tlak a notifikační zátěž.

### Rodič

- míra doručení;
- míra potvrzení;
- počet zpráv bez jasné akce;
- opt-out a preference;
- počet duplicitních kanálů;
- srozumitelnost.

## 9.3 Zakázané vanity metriky

Samostatně nesmějí řídit strategii:

- celkový počet registrací;
- počet vygenerovaných otázek;
- počet AI promptů;
- počet škol v databázi;
- počet vytvořených tříd;
- stažení aplikace;
- počet funkcí;
- mediální dosah bez konverze;
- kumulativní počet žáků bez aktivity a retence.

---

# 10. Pilot jako vědecký experiment

## 10.1 Co pilot musí zjistit

Pilot není demo pro pochvalu. Musí být schopen zabít naši hypotézu.

Hlavní otázky:

1. Které tři opakující se činnosti učitele mají nejvyšší časovou a psychickou cenu?
2. Použije učitel klíčové workflow i bez zakladatele?
3. Kde vzniká nový administrativní dluh?
4. Co učitel stále přepisuje do jiného systému?
5. Která automatizace vyvolává nedůvěru?
6. Kdy rodičovská notifikace pomáhá a kdy obtěžuje?
7. Zlepšuje herní smyčka účast bez nezdravého srovnávání?
8. Zaplatí škola za odstraněnou práci, nebo produkt pouze chválí?
9. Kdo je skutečný kupující, champion, blokátor a správce?
10. Co se rozbije při změně školního roku?

## 10.2 Baseline

Před nasazením měříme minimálně jeden týden:

- přípravu aktivit;
- distribuci;
- opravování;
- evidenci;
- připomínání;
- komunikaci;
- řešení přístupů;
- přepis výsledků;
- support mezi kolegy.

Měření kombinuje:

- jednoduchý časový deník;
- pozorování;
- krátké rozhovory;
- systémová data;
- vzorek konkrétních workflow.

## 10.3 Experimentální karty

Každá vertikála má kartu:

```text
Hypotéza:
Pro koho:
Současný proces:
Baseline čas:
Nový proces:
Očekávaná úspora:
Riziko:
Minimální důkaz:
Kill criterion:
Datum rozhodnutí:
```

## 10.4 Kill criteria

Příklad pro oznámení rodičům:

Funkci nerozšiřujeme do plného messagingu, pokud:

- učitelé nemají alespoň dvě opakující se situace měsíčně;
- většina zpráv vzniká mimo kontext SkillStormu;
- potvrzení přečtení nevede k nižšímu počtu ručních urgencí;
- administrace kontaktů vytvoří více práce, než odstraní;
- školy vyžadují plný obousměrný chat jako podmínku užitku;
- právní a support náklad převýší ochotu platit.

## 10.5 Pilotní vzorek

Po vlastní třídě musí následovat diverzifikace:

- 1. stupeň;
- 2. stupeň;
- střední škola nebo odborná výuka;
- technicky silný učitel;
- běžný učitel;
- skeptický učitel;
- třídní učitel;
- učitel bez třídnictví;
- vedení;
- ICT správce;
- rodiče s rozdílnou digitální jistotou.

---

# 11. Guardian a komunikace

## 11.1 Proč guardian není jen role

Guardian model je základ pro:

- právně a provozně správnou vazbu;
- preference per rodič–dítě;
- více rodičů a více dětí;
- oddělené domácnosti;
- omezený rozsah přístupu;
- provenance vztahu;
- odvolání a audit;
- komunikaci bez zveřejnění dat ostatních rodin.

## 11.2 Oznámení nejsou e-mailová funkce

E-mail je transportní kanál. Produktový objekt je **actionable notice**:

```text
Kdo zprávu vytváří?
Ke kterému dítěti/třídě/události patří?
Jaký je důvod?
Jaká akce se očekává?
Jaký je termín?
Je nutné přečtení, souhlas, platba, nebo pouze informace?
Kdo smí vidět stav?
Kdy se připomíná?
Kdy se eskaluje?
Jaký kanál rodič preferuje?
```

## 11.3 Minimální vertikála

1. vazba guardian–student;
2. preference a ověření kontaktu;
3. oznámení navázané na existující objekt;
4. in-app + e-mail;
5. doručení;
6. potvrzení přečtení;
7. cílená připomínka nepřečteným;
8. audit;
9. možnost opt-out tam, kde to povaha zprávy dovoluje;
10. žádný obecný chat.

## 11.4 Co nesmíme tvrdit

„Přečteno“ neznamená:

- pochopeno;
- souhlasím;
- zaplaceno;
- splněno;
- právně doručeno ve všech kontextech.

Každý stav musí být semanticky přesný.

---

# 12. AI Doctrine

## 12.1 Přípustné role AI

- první návrh;
- překlad;
- přeformulování podle věku;
- návrh otázek;
- návrh vysvětlení;
- sumarizace výsledků;
- detekce opakujících se vzorců;
- doporučení dalšího kroku;
- návrh komunikace;
- klasifikace provozních požadavků;
- pomoc s dohledáním zdroje;
- asistence učiteli při diferenciaci.

## 12.2 Vysoce citlivé role

Vyžadují explicitní kontrolu, audit a právní posouzení:

- známkování s významným dopadem;
- doporučení vzdělávací dráhy;
- označení dítěte za problémové nebo rizikové;
- rozhodnutí o přístupu k příležitosti;
- behaviorální profilování;
- automatické disciplinární kroky;
- generování citlivé komunikace bez schválení;
- využití biometrických nebo emočních inferencí.

## 12.3 Povinný provenance

U AI výstupu evidujeme podle rizika:

- model/provider;
- verzi;
- čas;
- vstupní kontext;
- zdroje;
- šablonu;
- upravující osobu;
- schválení;
- distribuci;
- možnost reprodukce nebo vysvětlení.

## 12.4 Ekonomika AI

AI kredity jsou interní nákladový mechanismus, ne produktová hodnota.

Uživatel chce vědět:

- kolik příprav vytvoří;
- kolik času ušetří;
- jaká je kvalita;
- co musí zkontrolovat;
- co se stane s daty.

Ceník nesmí působit jako mobilní hra s nečitelnou virtuální měnou.

---

# 13. Obsah a marketplace

## 13.1 Obsah sám o sobě není moat

Generativní AI snižuje cenu prvního návrhu obsahu. Zvyšuje však cenu:

- ověření;
- kurikulárního zařazení;
- věkové přiměřenosti;
- kvalitních distraktorů;
- licence;
- provenance;
- důkazu použití;
- zpětné vazby;
- aktualizace.

## 13.2 Síťový efekt nevznikne tlačítkem „sdílet“

Marketplace má hodnotu až tehdy, když:

1. existuje dost aktivních autorů;
2. existuje dost poptávky;
3. obsah má důvěryhodná metadata;
4. vyhledávání vrací relevantní výsledek;
5. kvalita je kontrolovatelná;
6. autor získává smysluplnou odměnu;
7. licence je pochopitelná;
8. škola ví, co může upravit a distribuovat.

## 13.3 Doporučené pořadí

1. soukromé materiály;
2. sdílení uvnitř školy;
3. kopírování s provenance;
4. ověřené platformní šablony;
5. reputace autora;
6. kurátorované veřejné sdílení;
7. teprve potom finanční marketplace.

Předčasný otevřený marketplace vytváří spam, copyright rizika a prázdnou výlohu.

---

# 14. Gamifikace a Parťák

## 14.1 Účel

Gamifikace má:

- snížit strach ze zapojení;
- podporovat pravidelnost;
- vizualizovat osobní pokrok;
- dát dětem bezpečný důvod vracet se;
- posílit pocit kompetence.

Nemá:

- vytvářet veřejnou hierarchii;
- monetizovat status;
- trestat výpadek;
- manipulovat úzkostí;
- nahrazovat pedagogickou kvalitu.

## 14.2 Nevyjednatelné principy

- XP za účast, snahu a dokončení, ne za absolutní skóre;
- žádné percentilové srovnávání dítěte s ostatními;
- parťák není diagnostická nálepka;
- dospělý nevyužívá parťáka k tlaku;
- hmotné odměny platí a kontrolují dospělí;
- žádný prodej XP;
- žádná sociální síť dětí;
- žádné soukromé zprávy mezi nezletilými.

## 14.3 Důkaz hodnoty

Parťák 2.0 se nerozšiřuje jen proto, že je vizuálně atraktivní. Musí prokázat:

- vyšší dobrovolnou účast;
- návrat bez nátlaku;
- pozitivní spontánní reakce dětí;
- absenci nezdravého srovnávání;
- přijatelný produkční náklad na assety;
- měřitelnou vazbu na užitečné učení.

---

# 15. Business model

## 15.1 Co prodáváme

Neprodáváme:

- GB;
- počet témat;
- počet tlačítek;
- obecné „AI kredity“ bez překladu do hodnoty.

Prodáváme:

- bezpečné nasazení;
- workflow;
- odstraněnou administrativu;
- školní kontext;
- analytiku;
- podporu;
- integrace;
- kontinuitu;
- důvěryhodnost.

## 15.2 Dvouvrstvý model

### Teacher Free / Pro

Účel:

- okamžitá hodnota;
- distribuce zdola;
- produktová zpětná vazba;
- přenositelné osobní portfolio;
- přirozené pozvání kolegy.

Omezení mohou být podle nákladů a organizačních funkcí, ne uměle frustrující limity běžné práce.

### School

Platí za:

- organizaci a správu rolí;
- onboarding a synchronizaci;
- guardian;
- audit;
- školní knihovnu;
- workflow automatizace;
- analytiku;
- SLA/podporu;
- governance;
- exporty a integrace;
- bezpečnostní a právní balíček.

## 15.3 Cenotvorba

Cena musí být nižší než konzervativně ověřená hodnota odstraněné práce a rizika.

Příklad výpočtu:

```text
Počet aktivních učitelů × ověřené ušetřené hodiny za rok
× konzervativní hodnota hodiny
= hrubá vytvořená hodnota

Roční licence musí zachytit jen část této hodnoty.
```

Do kalkulace se nesmí započítat čas, který produkt pouze přesune jinam.

## 15.4 Kdo kupuje

Role se nesmí míchat:

- **uživatel:** učitel, žák, rodič;
- **champion:** učitel, ICT koordinátor, zástupce;
- **ekonomický kupující:** ředitel, zřizovatel;
- **technický blokátor:** ICT správce, pověřenec, dodavatel SIS;
- **právní blokátor:** DPO, právník;
- **ovlivňovatel:** kolega, rodičovská rada, metodik;
- **správce změny:** vedení školy.

Go-to-market musí mít argument pro každou roli.

---

# 16. Moat

## 16.1 Co moat není

- použití LLM API;
- hezké UI;
- Google login;
- jeden editor testů;
- větší počet funkcí;
- levnější cena;
- jednorázový dataset;
- „jsme první“.

## 16.2 Potenciální složený moat

### A. Workflow data

Ne obsah konverzací, ale agregované znalosti o tom:

- kde procesy selhávají;
- které šablony šetří čas;
- jaké připomínky jsou účinné;
- jaké onboardingové výjimky se opakují.

Pouze při zákonném a etickém využití.

### B. Integrační hloubka

Spolehlivost napříč identitami, rosterem, oprávněními, školním rokem, guardian vztahy a auditem.

### C. Důvěra

Bezpečnost, transparentnost, žádná reklamní monetizace dětí, exportovatelnost a konzistentní provoz.

### D. Lokální workflow knihovna

Ne generický obsah, ale ověřené procesy přizpůsobené typu školy a jurisdikci.

### E. Distribuce mezi učiteli

Produkt, který učitel dobrovolně doporučí, protože mu vrací čas.

### F. Switching value

Škola zůstává, protože workflow fungují, tým je používá a znalost je sdílená — nikoli proto, že data nelze odnést.

### G. Evidence

Databáze ověřených časových úspor, implementačních vzorců a pedagogických výsledků.

## 16.3 Moat vzniká skládáním

Jednotlivou funkci konkurent okopíruje. Obtížnější je okopírovat současně:

- důvěryhodný guardian model;
- workflow engine;
- standardizované integrace;
- pedagogické principy;
- bezpečnost;
- školní distribuci;
- reálná data o úspoře;
- knihovnu ověřených procesů.

---

# 17. Roadmapa jako portfolio důkazů

Aktuální `MASTER.md` zůstává jediným zdrojem pravdy pro pořadí implementace. Doctrine nad něj přidává strategický test.

## 17.1 Hodnocení aktuální fronty

| Vertikála | Strategická role | Hlavní důkaz |
|---|---|---|
| Guardian B–D | identity, trust, rodičovská infrastruktura | bezpečná vazba a použitelnost bez support chaosu |
| Ostrý pilot | validace celé teze | používání bez zakladatele + baseline času |
| Oznámení | první workflow automatizace | méně ručních urgencí |
| Materiály/statistiky | školní znalost a budoucí síť | opakované použití a sdílení |
| Parťák 2.0 | engagement dětí | dobrovolná účast bez škodlivého tlaku |
| Offline Bleskovky | odolnost a prodejní diferenciátor | použití ve slabé konektivitě |
| Bleskovky A | škálování fungující smyčky | vyšší účast než režim B |
| Practice/přijímačky | B2C rozšíření | ochota rodičů platit a learning outcomes |

## 17.2 Nová povinná pole u roadmapy

Každá vertikála doplní:

- problém;
- baseline;
- cílovou úsporu;
- cílový pedagogický mechanismus;
- integrační závislost;
- bezpečnostní riziko;
- metodu měření;
- kill criterion;
- commercial hypothesis;
- international portability.

---

# 18. Strategické horizonty

## Horizont 1 — Důkaz užitku (2026–2027)

Cíle:

- bezpečný guardian;
- ostrý pilot;
- ověřit jeden opakovaný workflow;
- dokončit Google Workspace onboarding bez ručního chaosu;
- získat první placené obnovy;
- změřit čas před a po;
- najít hlavní champion personu.

Zakázáno:

- masivní marketplace;
- široká zahraniční expanze;
- obecný chat;
- paralelní vývoj mnoha vertikál;
- autonomní AI rozhodování.

## Horizont 2 — Opakovatelná škola (2027–2029)

Cíle:

- onboarding v hodinách, ne týdnech;
- standardní implementační balíček;
- více integračních konektorů;
- workflow knihovna;
- školní analytika;
- reference a partner channel;
- retence přes více školních roků;
- první slovenské školy.

## Horizont 3 — Evropská přenositelnost (2029–2032)

Cíle:

- multi-jurisdiction konfigurace;
- standardy LTI/OneRoster tam, kde dávají obchodní smysl;
- lokalizovaný obsah a workflow;
- partner-led implementace;
- jeden vybraný třetí trh;
- evropský bezpečnostní a compliance profil;
- oddělení core platformy od lokálních adaptérů.

## Horizont 4 — Inteligentní infrastruktura (2032–2035)

Cíle:

- kontextový školní asistent;
- automatizace napříč procesy;
- bezpečné adaptivní doporučování;
- interoperabilní marketplace;
- pokročilé řízení školních workflow;
- otevřený ekosystém partnerů;
- prokazatelný dopad v různých vzdělávacích systémech.

Horizont 4 je vize, ne závazný feature list.

---

# 19. Co když se mýlíme?

## 19.1 Kritické hypotézy

| Hypotéza | Co ji může vyvrátit |
|---|---|
| Učitelé chtějí jednu workflow vrstvu | raději zůstanou v jednotlivých známých nástrojích |
| Školy zaplatí za ušetřený čas | úsporu oceňují, ale rozpočet směřuje jen do obsahu/SIS |
| Guardian zvýší hodnotu | komunikace je již dostatečně vyřešena jinde |
| Integrace snižují friction | správa oprávnění a výjimek převáží přínos |
| Gamifikace zvyšuje účast bezpečně | efekt je krátkodobý nebo vytváří tlak |
| Marketplace vytvoří síťový efekt | učitelé nechtějí sdílet nebo je kvalita neřiditelná |
| AI návrhy šetří čas | kontrola a opravy sežerou úsporu |
| Česko je vhodný beachhead | nákupní cyklus a rozpočty neumožní zdravou firmu |
| Produkt je exportovatelný | lokální školní procesy jsou příliš odlišné |

## 19.2 Existenční rizika

1. feature creep;
2. závislost na jednom zakladateli při nasazení;
3. falešné bezpečí z pozitivní zpětné vazby vlastní školy;
4. podcenění podpory a změnového managementu;
5. citlivý incident s daty dítěte;
6. závislost na API platformy;
7. AI náklady a nekonzistentní kvalita;
8. nulová ochota vedení měnit workflow;
9. dlouhý prodejní cyklus;
10. produkt příliš široký pro malý tým.

## 19.3 Předem dohodnuté signály k pivotu

Strategii přehodnotíme, pokud po definovaném pilotním období:

- učitelé nepoužívají klíčový workflow týdně;
- není prokázána čistá časová úspora;
- většina hodnoty vzniká pouze díky osobní přítomnosti zakladatele;
- školy neobnovují placenou licenci;
- guardian/notifikace nevytvářejí měřitelnou provozní hodnotu;
- integrační náklady rostou lineárně s každou školou;
- jiný problém opakovaně převyšuje náš zvolený wedge.

---

# 20. Výzkumný program Doctrine

## Stream A — Čas učitele

Výstupy:

- časový deník;
- mapa workflow;
- přerušení;
- duplicity;
- nejdražší výjimky;
- rozdíl podle role a stupně školy.

## Stream B — Řízení školy

- kde vedení nemá přehled;
- jak se zavádí nový nástroj;
- kdo spravuje data;
- co brání adopci;
- jaký důkaz vyžaduje ředitel.

## Stream C — Rodina

- komunikační přetížení;
- preference kanálu;
- jazyk;
- více guardianů;
- potvrzení vs. souhlas;
- citlivé situace.

## Stream D — Učení

- formativní hodnocení;
- zpětná vazba;
- metakognice;
- adaptivní výuka;
- motivace;
- bezpečná gamifikace.

## Stream E — Infrastruktura

- Google Workspace;
- Microsoft 365;
- české SIS;
- LTI;
- OneRoster;
- exporty;
- školní rok;
- identity lifecycle.

## Stream F — Ekonomika

- willingness to pay;
- sales cycle;
- support cost;
- onboarding cost;
- AI cost;
- gross margin;
- renewal;
- expansion revenue.

## Stream G — Regulace a důvěra

- GDPR;
- AI Act;
- DPA;
- DPIA;
- rodičovské vazby;
- datová retence;
- audit;
- přístupnost;
- age-appropriate design.

---

# 21. Struktura budoucí „SkillStorm Book“

Doctrine v0.1 je základ. Plná zakladatelská kniha bude vznikat po samostatných, zdrojovaných kapitolách.

## BOOK I — REALITY

1. Česká škola jako organizace  
2. Čas učitele  
3. Čas ředitele  
4. Fragmentace systémů  
5. Digitální nerovnosti  
6. Nedostatek pedagogů  
7. Rodičovská komunikace  
8. Přechod mezi školními roky  
9. Stínové tabulky a neoficiální workflow  
10. Ekonomika školního softwaru  

## BOOK II — HUMAN LEARNING

1. Paměť a vybavování  
2. Zpětná vazba  
3. Formativní hodnocení  
4. Metakognice  
5. Kognitivní zátěž  
6. Motivace  
7. Diferenciace  
8. Adaptivní výuka  
9. Bezpečná gamifikace  
10. Limity personalizace  

## BOOK III — TEACHERS

1. Profesní autonomie  
2. Příprava výuky  
3. Hodnocení  
4. Administrativa  
5. Komunikace  
6. Digitální kompetence  
7. AI gramotnost  
8. Well-being  
9. Skeptický učitel  
10. Champion a změna  

## BOOK IV — SCHOOLS

1. Ředitel jako kupující  
2. ICT koordinátor  
3. DPO a bezpečnost  
4. Zřizovatel  
5. Rodiče  
6. Školní rok  
7. Incidenty  
8. Nákup a rozpočty  
9. Změnový management  
10. Institucionální paměť  

## BOOK V — TECHNOLOGY

1. Identity  
2. Multitenancy  
3. RBAC/ABAC  
4. Roster  
5. Události a workflow  
6. Interoperabilita  
7. Offline-first  
8. Audit  
9. Observabilita  
10. Exportovatelnost  

## BOOK VI — AI

1. Asistence vs. autonomie  
2. Generování obsahu  
3. Hodnocení  
4. Doporučování  
5. RAG a kurikulum  
6. Provenance  
7. Bias  
8. Bezpečnost  
9. AI Act  
10. Ekonomika modelů  

## BOOK VII — PRODUCT

1. Kategorie  
2. Wedge  
3. Teacher loop  
4. Student loop  
5. Guardian loop  
6. School loop  
7. Notification architecture  
8. Content graph  
9. Practice engine  
10. Marketplace  

## BOOK VIII — ETHICS

1. Důstojnost dítěte  
2. Soukromí  
3. Autonomie učitele  
4. Srovnávání  
5. Manipulace  
6. Přístupnost  
7. Inkluze  
8. Jazyk  
9. Odpovědnost  
10. Právo odejít  

## BOOK IX — BUSINESS

1. Segmentace  
2. Pricing  
3. Unit economics  
4. Freemium  
5. School sales  
6. Procurement  
7. Partnerships  
8. Customer success  
9. Retence  
10. Financování růstu  

## BOOK X — COMPETITION

1. ForClassmates  
2. UmímeTo  
3. Bakaláři  
4. EduPage  
5. Google  
6. Microsoft  
7. Moodle/Canvas  
8. Kahoot/Quizizz  
9. Horizontální AI  
10. Build, partner, integrate  

## BOOK XI — EXPANSION

1. Česko  
2. Slovensko  
3. Výběr třetího trhu  
4. Lokalizace  
5. Kurikulum  
6. Regulace  
7. Partneři  
8. Standardy  
9. Podpora  
10. Globální core vs. lokální adaptéry  

## BOOK XII — GOVERNANCE

1. Produktové rozhodování  
2. Evidence registry  
3. Kill criteria  
4. Bezpečnostní rady  
5. Model risk  
6. Incident response  
7. Dokumentace  
8. Verze Doctrine  
9. Konflikt principů  
10. Nástupnictví a kultura  

---

# 22. Rozhodnutí pro nejbližších 90 dní

## 22.1 Co neměníme

- jedna vertikála naráz;
- Guardian Etapa B jako aktuální architektonická priorita;
- ostrý pilot jako brána;
- Google Workspace onboarding před pilotem celé školy;
- žádný plný chat;
- žádné srovnávání dětí;
- server jako autorita;
- bezpečnost a audit jako základ.

## 22.2 Co doplňujeme

1. **Baseline časového auditu** ještě před ostrým pilotem.  
2. **Experimentální kartu** pro Guardian, Bleskovky a oznámení.  
3. **Instrumentaci VTHR** — nejprve interní, konzervativní.  
4. **Seznam duplicitních vstupů** ve stávajícím produktu.  
5. **Mapu systémů pilotní školy** — co zůstává v Google, co v SIS, co ve SkillStormu.  
6. **ForClassmates evidence file** — oddělit ověřené funkce od firemních claimů.  
7. **Architecture decision record pro interoperabilitu** — LTI/OneRoster nejsou nutně okamžitá implementace, ale model nesmí jejich budoucí přijetí blokovat.  
8. **Rodičovskou komunikační taxonomii** — informace, přečtení, souhlas, platba, splnění.  
9. **První ceníkovou value model tabulku** — hodnota času vs. licence.  
10. **Pilotní stop checkpoint** po prvních reálných týdnech, kde je přípustné změnit roadmapu.

## 22.3 Co odkládáme

- 200stránkovou finální knihu bez pilotních dat;
- široký veřejný marketplace;
- zahraniční launch;
- autonomního AI zaměstnance;
- obecný messenger;
- kopírování funkcí konkurence;
- velký paid marketing.

---

# 23. Zakladatelský slib

Budeme ambiciózní v cíli a konzervativní v tvrzeních.

Nebudeme říkat, že zachraňujeme školství, dokud neumíme prokázat, že jsme odstranili konkrétní práci a nezpůsobili novou.

Nebudeme měřit dítě jako engagement inventory.

Nebudeme nutit školu opustit nástroje, které fungují, jen proto, abychom zvětšili náš produkt.

Nebudeme používat AI jako omluvu pro nekvalitní obsah nebo netransparentní rozhodování.

Nebudeme zaměňovat registrace za hodnotu, pochvalu za ochotu platit a pilot za product-market fit.

Budeme se ptát:

- Co uživatel skutečně potřebuje dokončit?
- Proč to dnes trvá tak dlouho?
- Který krok lze odstranit?
- Jak víme, že jsme pomohli?
- Co se může pokazit?
- Máme právo tato data používat?
- Dokážeme funkci provozovat bezpečně ve stovkách škol?
- Je řešení přenositelné za hranice?
- Je to nejlepší použití našeho času a kapitálu?

> **SkillStorm uspěje tehdy, když technologie zmizí do pozadí a škole zůstane více času na lidi.**

---

# 24. Evidence registry — počáteční zdroje

[^talis-main]: OECD, *Results from TALIS 2024* — 280 000 educators, 55 education systems. https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en.html

[^talis-demands]: OECD, *The demands of teaching: Results from TALIS 2024*. https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en/full-report/the-demands-of-teaching_0e941e2f.html

[^talis-thriving]: OECD, *Thriving in teaching: Results from TALIS 2024*. https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en/full-report/thriving-in-teaching_340c1305.html

[^talis-cz]: OECD, *Czechia — Teachers and teaching conditions, TALIS 2024*. https://gpseducation.oecd.org/CountryProfile?primaryCountry=CZE&topic=TA&treshold=10

[^unesco-genai]: UNESCO, *Guidance for generative AI in education and research*. https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research

[^unesco-ai-policy]: UNESCO, *AI and education: guidance for policy-makers*. https://www.unesco.org/en/articles/ai-and-education-guidance-policy-makers

[^eu-hub]: European Commission, *European Digital Education Hub*. https://education.ec.europa.eu/focus-topics/digital-education/action-plan/european-digital-education-hub

[^eu-interoperability]: European Commission, *Digital education content: guidelines and interoperability framework*. https://education.ec.europa.eu/focus-topics/digital-education/actions/plan/digital-education-content-guidelines-and-framework

[^eu-plan]: European Commission, *Digital Education Action Plan 2021–2027*. https://education.ec.europa.eu/focus-topics/digital-education/actions

[^cz-strategy]: MŠMT, *Strategie vzdělávací politiky ČR do roku 2030+*. https://msmt.gov.cz/vzdelavani/skolstvi-v-cr/strategie-2030

[^digcompedu]: European Commission JRC, *Digital Competence Framework for Educators (DigCompEdu)*. https://joint-research-centre.ec.europa.eu/digcompedu_en

[^digcomp]: European Commission JRC, *Digital Competence Framework, DigComp 3.0*. https://joint-research-centre.ec.europa.eu/projects-and-activities/education-and-training/digital-transformation-education/digital-competence-framework-digcomp_en

[^eef-feedback]: Education Endowment Foundation, *Feedback*. https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/feedback

[^eef-metacognition]: Education Endowment Foundation, *Metacognition and self-regulation*. https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-regulation

[^eef-edtech]: Education Endowment Foundation, *Research agenda theme: EdTech*. https://educationendowmentfoundation.org.uk/projects-and-evaluation/research-agenda-themes-priority-areas/research-agenda-theme-edtech

[^lti]: 1EdTech, *Learning Tools Interoperability (LTI)*. https://www.1edtech.org/standards/lti

[^oneroster]: 1EdTech, *OneRoster*. https://www.1edtech.org/standards/oneroster

[^oneroster-procurement]: 1EdTech, *OneRoster Planning and Procurement Guide*. https://www.1edtech.org/standards/oneroster/OneRoster-Procurement-Guide

[^gdpr]: European Union, *Regulation (EU) 2016/679 — GDPR*. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679

[^bik]: European Commission, *A Digital Decade for children and youth / BIK+*. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52022DC0212

[^ai-act]: European Union, *Regulation (EU) 2024/1689 — Artificial Intelligence Act*. https://eur-lex.europa.eu/eli/reg/2024/1689/oj

[^cz-pupils]: Český statistický úřad, *Mateřské, základní a střední školy*. https://csu.gov.cz/materske-zakladni-a-stredni-skoly

[^cz-teachers]: Český statistický úřad, *Počty středoškoláků rostou* — údaje o učitelích ZŠ. https://statistikaamy.csu.gov.cz/pocty-stredoskolaku-rostou

[^cz-yearbook]: MŠMT, *Statistická ročenka školství 2025/2026*. https://statis.msmt.gov.cz/rocenka/rocenka.asp

[^eu-teachers]: Eurostat, *The backbone of education: EU’s 5.26 million teachers*. https://ec.europa.eu/eurostat/web/products-eurostat-news/w/edn-20251002-1

[^eu-primary]: Eurostat, *Primary education statistics*. https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Primary_education_statistics

[^google-classroom]: Google for Education, *Google Classroom*. https://edu.google.com/workspace-for-education/products/classroom/

[^ms-sds]: Microsoft Learn, *School Data Sync*. https://learn.microsoft.com/en-us/schooldatasync/

[^ms-guardian]: Microsoft Learn, *Sync Parents and Guardian Contacts in SDS*. https://learn.microsoft.com/en-us/schooldatasync/parents-and-guardians-in-sds

[^forclassmates-home]: ForClassmates, veřejná produktová a cenová prezentace. https://www.forclassmates.com/cs

[^forclassmates-claim]: ForClassmates / ProSpolužáky, veřejné firemní tvrzení o 150 000 studentech a 330 školách; nejde o nezávisle auditované provozní údaje. https://www.facebook.com/prospoluzaky.cz/

[^forclassmates-schools]: ProSpolužáky, veřejné tvrzení o používání učebnic a pracovních sešitů ve 300 školách. https://www.prospoluzaky.cz/pro-ucitele/

[^unesco-data]: UNESCO Institute for Statistics, *World Education Statistics 2025*. https://www.uis.unesco.org/en/publication/world-education-statistics-2025

---

# 25. Revizní log

| Datum | Verze | Změna |
|---|---|---|
| 21. 7. 2026 | 0.1 | První evidence baseline: kategorie, principy, trh, konkurence, wedge, metriky, pilot, AI, guardian, moat, expanze a 90denní rozhodnutí |

---

# 26. Otevřené výzkumné otázky pro verzi 0.2

1. Kolik času tráví různé typy českých učitelů konkrétními opakujícími se činnostmi?
2. Které procesy jsou již dostatečně vyřešeny Google Workspace, Microsoft 365 a SIS?
3. Kolik škol skutečně aktivně používá ForClassmates digitálně a jak hluboko?
4. Jaké jsou reálné rozpočty českých ZŠ na pedagogický software?
5. Kdo má podpisovou pravomoc a jak dlouhý je nákupní cyklus?
6. Která oznámení rodiče chtějí a která považují za spam?
7. Je potvrzení přečtení dostatečně hodnotné bez plateb a souhlasů?
8. Kolik supportu vyžaduje guardian model v různých rodinných situacích?
9. Kde vzniká největší čistá časová úspora v pilotní škole?
10. Který druh školy je nejlepší první ICP?
11. Jak měřit VTHR bez manipulativních odhadů?
12. Které OneRoster/LTI scénáře mají reálný obchodní význam pro Evropu?
13. Jak oddělit globální core od českých lokálních adaptérů?
14. Jaký minimální důkaz ospravedlní Parťák 2.0?
15. Kdy má marketplace dostatečnou kritickou masu?
16. Jaká je ochota platit jednotlivého učitele oproti škole?
17. Jaké AI funkce skutečně zkracují práci po započtení kontroly?
18. Jaké části produktu mohou být high-risk podle AI Act?
19. Jak nastavit DPA, DPIA, retenci a export pro pilot?
20. Která strategická hypotéza je dnes nejpravděpodobněji chybná?
