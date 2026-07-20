# SkillStorm – zjednodušení rodičovského prostředí a rodinné spuštění žákovských aktivit

Proveď analýzu a následnou implementaci zjednodušeného rodičovského prostředí v aplikaci SkillStorm.

Cílem není pouze graficky upravit rodičovský dashboard. Je potřeba vyřešit celý uživatelský, bezpečnostní a datový model tak, aby:

* aplikaci bez problémů používali i rodiče s nízkou digitální gramotností;
* zkušenější rodiče měli dostupné podrobnější informace;
* rodič nemusel znát heslo dítěte;
* rodič mohl dítěti na společném zařízení spustit procvičování, úkol nebo povolený test;
* bylo vždy dohledatelné, kdo aktivitu spustil a komu patří výsledek;
* rodič a dítě nesdíleli jednu identitu ani jeden společný účet;
* řešení podporovalo více dětí na jednoho rodiče a více rodičů na jedno dítě;
* nebyla narušena důvěryhodnost klasifikovaných testů.

## 1. Základní produktový princip

Rodič a žák musí mít oddělené identity.

Neslučuj rodiče a dítě do jednoho uživatelského účtu ani do jednoho společného profilu.

Místo toho vytvoř:

* samostatný uživatelský účet rodiče;
* samostatný žákovský profil dítěte;
* explicitní ověřenou vazbu mezi rodičem a dítětem;
* společný uživatelský pohled nazvaný „Rodinný prostor“;
* možnost rodičem autorizované dočasné žákovské relace.

Rodinný prostor je pouze zjednodušené uživatelské rozhraní nad oddělenými identitami. Nesmí představovat společný účet.

## 2. Hlavní uživatelský scénář

Typický scénář:

1. Otec je přihlášený vlastním rodičovským účtem.
2. Sedí doma se synem u jednoho zařízení.
3. Otec vybere syna v Rodinném prostoru.
4. Klikne na „Spustit pro Matěje“.
5. Aplikace vytvoří dočasnou žákovskou relaci pro Matěje.
6. Rozhraní se přepne do jasně označeného žákovského režimu.
7. Syn vypracuje aktivitu.
8. Výsledek se uloží synovi.
9. Audit zaznamená, že relaci spustil otec.
10. Po ukončení se aplikace vrátí do rodičovského režimu.

Rodič nesmí potřebovat heslo dítěte.

Rodičovské spuštění zároveň nesmí být technicky považováno za přihlášení rodiče pod identitou dítěte.

## 3. Rodinný prostor

Po přihlášení rodiče zobraz jednoduchý Rodinný prostor.

Pokud má rodič jedno dítě, vyber jej automaticky.

Pokud má více dětí, zobraz jednoduchý přepínač dítěte:

* jméno;
* avatar nebo fotografie;
* třída;
* případně škola.

Výchozí rodičovská obrazovka má obsahovat maximálně tyto hlavní části:

### Co je potřeba udělat

Zobraz pouze nejdůležitější aktuální položky:

* úkoly;
* testy;
* termíny;
* nevyřešené požadavky;
* důležitá upozornění.

### Jak se dítěti daří

Zobraz jednoduché a srozumitelné shrnutí:

* co dítě dokončilo;
* v čem se zlepšuje;
* s čím má problém;
* zda má něco po termínu.

Nepoužívej jako výchozí složité grafy ani technické metriky.

### Zprávy

Zobraz důležité zprávy od školy nebo učitele.

### Doporučený další krok

Zobraz jednu konkrétní doporučenou akci:

* dokončit úkol;
* procvičit téma;
* zopakovat neúspěšné otázky;
* kontaktovat učitele.

Na jedné obrazovce má být zpravidla pouze jedna dominantní primární akce.

## 4. Základní a podrobné zobrazení

Nevytvářej dvě různé aplikace pro méně a více zkušené rodiče.

Použij princip postupného odkrývání informací.

### Základní zobrazení

Musí být výchozí pro všechny rodiče.

Obsahuje:

* jednoduchý jazyk;
* větší ovládací prvky;
* omezenou navigaci;
* jasné termíny;
* jasné stavové informace;
* jednu hlavní akci;
* minimum nastavení;
* vysvětlení výsledků běžným jazykem.

Ve výchozím stavu nezobrazuj:

* technické názvy stavů;
* složité grafy;
* detailní bodování každé otázky;
* historii všech pokusů;
* pokročilé filtry;
* exporty;
* interní identifikátory;
* administrativní funkce;
* systémová nastavení.

### Podrobné zobrazení

Přidej nenápadnou možnost:

„Zobrazit více podrobností“

Po aktivaci může rodič vidět:

* výsledky po předmětech;
* historii pokusů;
* podrobné bodování;
* vývoj v čase;
* detailní doporučení;
* jednotlivé odpovědi, pokud je škola zpřístupní;
* exporty, pokud jsou povolené;
* správu notifikací;
* správu propojených dětí.

Volbu ukládej jako uživatelskou preferenci.

Nepoužívej označení jako „režim pro seniory“ nebo „režim pro začátečníky“.

## 5. Rodinné spuštění aktivity

Přidej funkci, která rodiči umožní spustit aktivitu pro dítě.

Tlačítko může mít například text:

* „Spustit pro Matěje“
* „Pokračovat jako Matěj“
* „Předat zařízení Matějovi“

Po spuštění:

* vytvoř časově omezenou žákovskou relaci;
* přiřaď ji konkrétnímu dítěti;
* zaznamenej rodiče, který ji spustil;
* skryj celé rodičovské rozhraní;
* zobraz pouze povolenou žákovskou aktivitu;
* trvale zobraz jasný informační pruh.

Příklad informačního pruhu:

„Režim žáka: Matěj Novák · Spuštěno rodičem · Ukončit žákovský režim“

Dítě nesmí během žákovské relace vstoupit do:

* rodičovského přehledu;
* výsledků sourozenců;
* rodičovských zpráv;
* nastavení účtu rodiče;
* plateb;
* správy propojených osob.

Návrat do rodičovské části může vyžadovat rodičovský PIN nebo opětovné ověření rodiče.

## 6. Rozlišení typů aktivit

Nepoužívej stejnou úroveň zabezpečení pro všechny aktivity.

### Nezávazné procvičování

Rodič může aktivitu spustit bez dalšího ověření dítěte.

Je přípustné, aby rodič dítěti pomáhal.

Výsledek nemusí být považován za samostatně ověřený výkon dítěte.

### Domácí úkol

Rodič může úkol spustit.

Podle nastavení učitele může být před zahájením nebo odevzdáním vyžadován:

* jednoduchý žákovský PIN;
* potvrzení dítěte;
* jednorázový kód;
* žádné další ověření.

### Klasifikovaný test

Učitel musí při zadání určit pravidlo spuštění.

Podporuj minimálně tyto režimy:

* rodič může test spustit bez dalšího ověření;
* rodič může test spustit, ale dítě zadá PIN;
* dítě se musí samostatně přihlásit;
* dítě použije školní SSO;
* dítě zadá jednorázový kód od učitele;
* test lze vyplnit pouze ve škole;
* test nelze spustit z rodičovského účtu.

Výchozí nastavení klasifikovaného testu nesmí automaticky předpokládat, že rodičem spuštěný test je důvěryhodný samostatný výkon dítěte.

## 7. Míra důvěryhodnosti výsledku

Každé odevzdání musí obsahovat informaci o způsobu vzniku.

Rozliš minimálně:

* dítě se přihlásilo samostatně;
* relaci spustil rodič;
* relaci spustil učitel;
* dítě bylo ověřeno PINem;
* dítě bylo ověřeno heslem;
* dítě bylo ověřeno SSO;
* nebylo provedeno další ověření;
* byla deklarována pomoc rodiče.

Učitel musí být schopen poznat, zda:

* dítě pracovalo samostatně;
* aktivitu spustil rodič;
* identita dítěte byla dodatečně ověřena;
* rodič deklaroval pomoc;
* výsledek lze považovat za klasifikovaný.

Nevytvářej falešný dojem, že technické spuštění testu automaticky prokazuje samostatnou práci dítěte.

## 8. Vazba rodiče a dítěte

Doplň explicitní model vztahu rodiče a dítěte.

Vztah musí podporovat:

* jednoho rodiče s více dětmi;
* jedno dítě s více rodiči nebo zákonnými zástupci;
* rodiče propojeného s dětmi v různých organizacích;
* časově omezený přístup;
* odebrání přístupu;
* ověření školou;
* audit změn.

Vztah musí obsahovat minimálně:

* rodičovský účet;
* žákovský profil;
* organizaci;
* typ vztahu;
* stav vztahu;
* datum ověření;
* osobu, která vztah ověřila;
* oprávnění;
* datum ukončení vztahu;
* auditní časové údaje.

Navrhni vhodné názvy, například:

* `GuardianStudentRelation`;
* `GuardianLink`;
* `StudentGuardian`.

Preferuj jeden jednoznačný doménový název a používej jej konzistentně.

## 9. Oprávnění rodiče

Neomezuj rodičovský přístup pouze obecnou rolí `PARENT`.

Oprávnění musí být vyhodnocováno vůči konkrétnímu dítěti.

Podporuj například:

* zobrazení výsledků;
* zobrazení úkolů;
* spouštění procvičování;
* spouštění domácích úkolů;
* spouštění testů;
* příjem notifikací;
* správu přístupu dítěte;
* reset žákovského PINu;
* nákup obsahu;
* export výsledků;
* komunikaci s učitelem.

Změna úrovně zobrazení nesmí změnit bezpečnostní oprávnění.

„Zobrazit více podrobností“ smí změnit pouze prezentaci již povolených dat.

## 10. Více rolí jednoho uživatele

Prověř současný model, ve kterém má člen organizace pouze jednu roli.

Systém musí podporovat situaci, kdy je jeden člověk současně například:

* učitel a rodič;
* ředitel a rodič;
* rodič více dětí;
* zaměstnanec školy a člen komunitního kurzu.

Nenahrazuj tento problém výjimkami typu `if teacher and parent`.

Navrhni robustní model více rolí, například:

* `Membership`;
* `MembershipRoleAssignment`;
* více přiřazených rolí na jedno členství.

Ověř dopad na:

* RBAC;
* přihlašování;
* navigaci;
* audit;
* existující API;
* migraci současných dat.

## 11. Žákovský účet bez e-mailu

Podporuj mladší děti, které nemají vlastní e-mail.

Žákovský účet může používat:

* uživatelské jméno;
* jednoduchý PIN;
* QR kód;
* školní přihlašovací kód;
* Google Workspace SSO;
* Microsoft SSO;
* přístup spuštěný rodičem.

Dítě musí stále mít samostatnou technickou identitu a vlastní historii.

Nikdy neukládej výsledky dítěte přímo pod účet rodiče.

## 12. Datový model

Navrhni minimálně následující doménové části:

### Guardian relation

Model vztahu rodiče a dítěte.

### Learning session

Model relace, ve které dítě vykonává aktivitu.

Měl by obsahovat minimálně:

* dítě;
* uživatele, který relaci zahájil;
* způsob zahájení;
* způsob ověření dítěte;
* informaci o případné pomoci;
* začátek;
* konec;
* expiraci;
* stav relace;
* organizaci.

### Submission provenance

Odevzdání musí odkazovat na relaci nebo jiným jednoznačným způsobem uchovávat původ odevzdání.

Musí být možné odpovědět na otázky:

* Komu výsledek patří?
* Kdo aktivitu spustil?
* Kdo byl během aktivity ověřen?
* Jakým způsobem byl ověřen?
* Byla deklarována pomoc?
* Za jakých pravidel byl test spuštěn?

### Interface preference

Ulož uživatelskou preferenci základního nebo podrobného zobrazení.

Nepoužívej pouze volné stringy tam, kde je vhodný enum nebo jednoznačně definovaný typ.

## 13. Bezpečnost relace

Rodičem spuštěná žákovská relace musí být:

* časově omezená;
* omezena na konkrétní dítě;
* omezena na konkrétní aktivitu nebo povolený rozsah;
* oddělena od rodičovské session;
* auditovatelná;
* zrušitelná;
* neobnovitelná pomocí obyčejného browser back;
* chráněná proti změně `studentId` v URL nebo requestu;
* kontrolovaná na backendu, nikoliv pouze ve frontendu.

Backend musí ověřit:

* že rodič má aktivní ověřený vztah k dítěti;
* že rodič má oprávnění aktivitu spustit;
* že aktivita rodičovské spuštění povoluje;
* že dítě má k aktivitě přístup;
* že relace nevypršela;
* že odevzdání patří správnému dítěti;
* že nedošlo k cross-tenant přístupu.

Nepřijímej identitu dítěte pouze z dat zaslaných frontendem.

## 14. UX požadavky

Používej jednoduchý jazyk.

Nevhodné:

* `Submission pending`
* `Assignment expiration`
* `Guardian impersonation`
* `Verification method: NONE`

Vhodné:

* „Čeká na odevzdání“
* „Odevzdat do pátku“
* „Spustit pro Matěje“
* „Matěj nebyl dodatečně ověřen“
* „Test spustil rodič“

Každá obrazovka musí jasně odpovědět:

* Za koho právě pracuji?
* Co mám udělat?
* Do kdy?
* Co se stane po odevzdání?
* Mohu se vrátit bez ztráty práce?

Nevytvářej dlouhé formuláře.

Pokročilá nastavení schovej pod:

* „Další možnosti“;
* „Podrobnosti“;
* „Nastavení“.

## 15. Onboarding rodiče

První použití rodičovské části má mít maximálně tři hlavní kroky:

1. Propojení nebo potvrzení dítěte.
2. Nastavení důležitých upozornění.
3. Zobrazení aktuálního úkolu nebo přehledu dítěte.

Nevyžaduj při registraci konfiguraci funkcí, které rodič zatím nepotřebuje.

Pokud propojení vytvořila škola předem, rodič jej pouze potvrdí.

Podporuj bezpečné propojení například pomocí:

* pozvánky na e-mail;
* jednorázového kódu od školy;
* QR kódu;
* schválení školou;
* ověřeného SSO účtu.

## 16. Audit

Audituj minimálně:

* vytvoření vztahu rodič–dítě;
* potvrzení vztahu;
* změnu oprávnění;
* odebrání vztahu;
* spuštění žákovské relace;
* způsob ověření dítěte;
* zahájení testu;
* odevzdání testu;
* ukončení relace;
* reset PINu;
* pokus o neoprávněný přístup.

Auditní záznam nesmí nahrazovat běžnou doménovou vazbu.

## 17. Migrace

Připrav bezpečnou Prisma migraci.

Migrace musí:

* zachovat současné uživatele;
* zachovat současná členství;
* zachovat výsledky a odevzdání;
* převést současné role bez ztráty oprávnění;
* nevyžadovat ruční mazání produkčních dat;
* být zpětně dohledatelná;
* obsahovat vhodné indexy a unikátní constrainty.

Před vytvořením migrace analyzuj současné schéma a existující použití:

* `User`;
* `Membership`;
* `OrganizationRole`;
* `Student`;
* `Submission`;
* `Assignment`;
* RBAC model.

Nevytvářej paralelní duplicitní modely, pokud lze bezpečně rozšířit současné.

## 18. API

Navrhni jednoznačné endpointy nebo aplikační use-cases například pro:

* získání dětí dostupných rodiči;
* vytvoření nebo potvrzení rodičovské vazby;
* zobrazení Rodinného prostoru;
* spuštění žákovské relace;
* ověření dítěte PINem;
* ukončení relace;
* získání aktivní žákovské relace;
* spuštění konkrétní aktivity;
* odevzdání aktivity;
* zobrazení původu odevzdání učiteli.

Nepoužívej obecný endpoint typu:

`POST /login-as-user`

Použij doménově omezenou operaci, například:

`POST /guardian/student-sessions`

Relace musí být vytvořena pouze pro dítě, ke kterému má rodič ověřený vztah.

## 19. Testy

Doplň unit, integrační a e2e testy.

Minimální scénáře:

### Oprávněné spuštění

* rodič má ověřený vztah k dítěti;
* spustí povolené procvičování;
* relace vznikne;
* výsledek se uloží dítěti;
* audit uvádí rodiče jako iniciátora.

### Neoprávněné dítě

* rodič změní `studentId` v requestu;
* backend požadavek odmítne;
* nevznikne session ani submission.

### Cross-tenant ochrana

* rodič z organizace A nesmí spustit aktivitu dítěte organizace B bez příslušného vztahu.

### Klasifikovaný test

* test zakazuje rodičovské spuštění;
* API požadavek odmítne;
* frontend zobrazí srozumitelné vysvětlení.

### PIN dítěte

* správný PIN relaci ověří;
* nesprávný PIN ji neověří;
* počet pokusů je omezen;
* PIN není uložen ani logován v otevřené podobě.

### Více dětí

* rodič bezpečně přepíná mezi dětmi;
* data se nikdy nepromíchají;
* aktivní relace vždy patří jen jednomu dítěti.

### Návrat do rodičovské části

* dítě nemůže ukončením nebo změnou URL otevřít rodičovskou administraci;
* návrat vyžaduje odpovídající rodičovské ověření.

### Původ odevzdání

* učitel vidí, zda relaci spustil rodič;
* vidí způsob ověření;
* vidí deklarovanou pomoc;
* běžný rodič nevidí interní auditní údaje.

## 20. Rozsah první verze

Implementuj nejdříve jednoduché MVP bez zbytečného rozšiřování.

MVP musí obsahovat:

1. Vazbu rodiče a dítěte.
2. Rodinný prostor.
3. Přepínání mezi dětmi.
4. Základní rodičovský dashboard.
5. Základní a podrobné zobrazení.
6. Rodičem spuštěnou omezenou žákovskou relaci.
7. Rozlišení procvičování, úkolu a klasifikovaného testu.
8. Audit iniciátora relace.
9. Bezpečný návrat do rodičovského režimu.
10. Unit, integrační a e2e testy.

V první verzi nepřidávej:

* biometrické ověřování;
* sledování kamerou;
* pokročilý proctoring;
* automatické rozpoznávání, zda rodič pomáhal;
* složitý scoring důvěryhodnosti;
* další gamifikaci;
* nový komunikační systém;
* rozsáhlé analytické dashboardy.

## 21. Povinný postup práce

Nezačínej okamžitě implementací.

Nejdříve:

1. Projdi současné Prisma schéma.
2. Najdi existující frontendové rodičovské a žákovské stránky.
3. Najdi současné auth a RBAC guardy.
4. Najdi způsob vytváření `Submission`.
5. Najdi současná pravidla `Assignment`.
6. Zmapuj všechny závislosti na `Membership.role`.
7. Urči dopady migrace.
8. Navrhni nejmenší konzistentní změnu.

Poté předlož stručný implementační plán obsahující:

* root cause současného problému;
* cílový datový model;
* změny API;
* změny frontendu;
* bezpečnostní model;
* migrační strategii;
* testovací strategii.

Následně implementuj řešení po logických vrstvách.

Nevytvářej pouze mockup nebo izolovanou frontendovou simulaci.

## 22. Výstupní report

Na konci uveď:

### Co bylo změněno

Přesné soubory a hlavní změny.

### Jak funguje nový scénář

Popiš cestu rodič → výběr dítěte → spuštění aktivity → žákovský režim → odevzdání → návrat.

### Datový model

Uveď nové a změněné Prisma modely a vztahy.

### Bezpečnost

Popiš backendové kontroly a oddělení rodičovské a žákovské identity.

### Migrace

Uveď název migrace a způsob zachování existujících dat.

### Testy

Uveď přesné spuštěné příkazy a výsledky.

### Známá omezení

Uveď pouze skutečná omezení první verze.

### Verdikt

Použij jeden z verdiktů:

* `READY_TO_COMMIT`
* `READY_TO_MERGE`
* `BLOCKED`

Verdikt musí být podložen ověřením, nikoliv pouze subjektivním hodnocením.

## Výsledný požadavek

Výsledkem musí být jednoduché rodičovské prostředí, ve kterém rodič bez technických znalostí rychle zjistí, co dítě potřebuje udělat, a může mu bezpečně spustit aktivitu na společném zařízení.

Rodič a dítě přitom zůstávají samostatnými identitami.

Výsledky se ukládají dítěti.

Systém vždy ví:

* komu výsledek patří;
* kdo aktivitu spustil;
* jak bylo dítě ověřeno;
* zda byl daný způsob spuštění pro aktivitu povolen.

Preferuj jednoduché, bezpečné a doménově čisté řešení před rozsáhlou nebo efektní implementací.
