# Jak pracujeme s Claudem (a Claude Code)

> Návod pro každého, kdo zadává práci na SkillStormu. Jedna stránka — přečti celou, pak zadávej.
> Vzniklo destilací procesu, kterým prošel celý projekt: redesign, hardening, Bleskovky, kampaně, hlasování, interakce.

---

## Dělba práce

- **Ty (člověk):** vize, vkus, učitelská realita, produktová rozhodnutí, review na STOPech, čtení reportů.
- **Claude (chat):** překlad vize do zadání s invarianty a kritérii, strategická oponentura, review návrhů modelů.
- **Claude Code:** exekuce v repu — analýza, implementace, testy, reporty.
- **Dokumenty v repu:** paměť. Co není v souboru, zítra neplatí.

## Pravidlo #1 — Kontext žije v souborech, ne v promptech

Session začíná odkazem, ne vysvětlováním:

> „Přečti si `docs/guardian-project.md`. Děláme Etapu B, krok 2. Pokračuj podle dokumentu."

Hierarchie pravdy (při konfliktu platí vyšší):
1. `CLAUDE.md` — principy platné vždy (parťák neviditelný pro dospělé, XP nikdy za skóre, DB guard, git konvence)
2. `docs/master-roadmap.md` — pořadí a priority
3. Projektový dokument (`guardian-project.md`, `partak-2.0.md`) — detail projektu, STOPy, invarianty
4. `docs/decisions/*` — proč jsme co rozhodli (zamítnuté věci se neotevírají z neznalosti)
5. Zadání konkrétní session

## Pravidlo #2 — Anatomie dobrého zadání

```
Cíl: (jedna věta)
Branch: (název)
Bloky/kroky: (očíslované, každý = commit + report)
NEPORUŠITELNÁ PRAVIDLA: (invarianty explicitně, i "samozřejmé" —
  autosave se nemění, correctKey neodchází před revealem,
  destruktivní operace jen proti _test)
KRITÉRIUM HOTOVOSTI: (co musí být zelené + JAKÝ DŮKAZ chci vidět)
EXPLICITNĚ MIMO ROZSAH: (co NEZAČÍNAT — nejdůležitější sekce,
  Claude je snaživý a rád "dodělá okolí")
```

## Pravidlo #3 — STOP na nevratném, autonomie na vratném

- **Datový model, architektura, migrace, bezpečnostní model → vždy STOP a schválení.** To se za měsíc nedá vzít zpátky.
- **Implementace po blocích → autonomně.** Commit + krátký report po každém bloku; nečekat na schválení, pokud to zadání neříká.
- **Nečekané rozhodnutí za běhu:** zapsat možnosti + zvolený default do decisions logu a pokračovat. Ráno se reviduje log, ne probdělá noc.
- Hlídáš **rozhodnutí**, ne kroky.

## Pravidlo #4 — Důkazy, ne ujištění

„Testy prošly" nestačí. Zadání říká, jaký důkaz chceš:
- počty testů a suit, 3× po sobě zelené pro stabilitu,
- `git diff --stat` = prázdný pro soubory, které se nesměly změnit,
- log guardu, který zastavil zakázaný běh (negativní zkouška!),
- screenshoty (včetně mobilního viewportu), snapshot porovnání DB,
- network tab pro „X nikdy neodchází na klienta".

Nejcennější momenty projektu byly, když důkaz odhalil skutečný problém (Prisma env únik do jest procesu; 429 maskovaná jako auth fail; throttler s okny 60 ms).

## Pravidlo #5 — Reporty čti jako reviewer

Claude Code reportuje poctivě — včetně nepříjemností schovaných ve vedlejších větách („zabil jsem ti dev server", „stash nosím třetí session", „5 CI jobů je červených už na mainu"). Tvoje práce:
- **nálezy povyšuj na tasky** (jeden RBAC nález = hledej celý vzor — viz homeroom audit),
- **provozní dluhy nenech vyšumět** (červený main = normalizace selhání = smrt CI),
- **breaking changes si vědomě odsouhlas** (změna flow projekce = musíš to mít v prstech u tabule),
- **nerozumíš-li vlastní feature, je to signál o produktu** — ptej se, pak zjednodušuj.

## Pravidlo #6 — Intuice je validní zadání

„Přijde mi to divné", „chci aby to bylo popici", „ať to pohltí jak seriál" — to jsou nejlepší možné vstupy, pokud projdou překladem: pocit → pojmenovaný problém → specifikace s invarianty. Nikdy pocit nezahazuj a nikdy ho neposílej do Claude Code nepřeložený.

## Anti-patterny (draze zaplacené)

| Anti-pattern | Proč ne | Místo toho |
|---|---|---|
| „Přepiš to celé, je to hrozné" | 200 souborů v diffu, nerevidovatelné | fáze, bloky, commity po celcích |
| Kontext opakovaný v promptech | drift mezi sessions | soubory jako paměť |
| Míchání refactoru s featurami v PR | nepoznáš, co je co | jedna věc = jeden PR |
| Necommitnutá práce ve stashi přes sessions | stash není záloha | commit na branch, hned |
| „Testy prošly" bez důkazu | víra místo vědění | konkrétní důkaz v zadání |
| Nový projekt přes rozdělané PR | fronta závislostí, rebase peklo | slot 0: dokončit, pak začít |
| Retry/timeout jako řešení flaky testu | maskuje příčinu | oprav příčinu (viz Flake A/B) |

## Rituály

- **Nová session:** odkaz na dokument + kde jsme + co je další krok.
- **Konec bloku:** commit, report (co, jak ověřeno, co selhalo a jak opraveno).
- **Konec projektu:** PR se souhrnem, screenshoty, aktualizace master roadmapy (revizní log).
- **Nový nápad mimo plán:** do decisions logu / nápadníku, ne do rozdělané práce.