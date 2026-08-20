# SkillStorm — ZŠ Product Polish

## Cíl

SkillStorm musí během prvních pěti sekund působit jako hotový pracovní produkt pro reálnou základní školu, ne jako sada administrativních obrazovek.

## Vertical slice

Ředitel → učitel → třída → žák → výuka → odevzdání → výsledek.

## Akceptační kritéria

### Učitel
- první obrazovka říká, co je potřeba dnes řešit;
- vidí počet svých tříd, žáků a čekajících odevzdání;
- hlavní akce pro živou výuku je dostupná okamžitě;
- vytvoření testu, zadání a otevření tříd je na jeden klik;
- žádná rychlá akce nesmí vést na neexistující route.

### Žák
- první obrazovka má jednoznačnou hlavní další akci;
- nejbližší otevřené zadání je vizuálně prioritní před statistikami;
- XP, streak a školní pokrok podporují motivaci, ale nepřekrývají hlavní úkol;
- stav bez otevřeného zadání dává jasný pozitivní další krok.

### Ředitel
- první obrazovka funguje jako školní cockpit;
- nejprve problémy a věci vyžadující zásah, potom agregátní statistiky;
- třídy a učitelé mají čitelný stav, ne jen čísla;
- kritické provozní akce jsou dostupné bez hledání v menu.

### Demo data
- školní rok 2026/2027;
- realistické názvy lidí, tříd, předmětů, testů a aktivit;
- data obsahují zdravé i problémové případy, aby dashboardy nebyly prázdné;
- žádné produkční demo nesmí používat placeholdery typu „Žák 8.C #1“ jako hlavní prezentaci produktu.

## Důkaz hotového milestone

- zelený frontend typecheck/build;
- zelené relevantní E2E scénáře;
- desktop + mobil screenshoty z reálného browser běhu;
- video vertical slice bez interních API mocků;
- žádné rozbité CTA v prezentovaném flow.
