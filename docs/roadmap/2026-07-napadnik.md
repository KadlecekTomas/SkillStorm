# Strategická rozhodnutí — nápadník 07/2026

> Záznam rozhodnutí nad seznamem nápadů (červenec 2026). Každý bod má verdikt a odkaz, kde žije dál. Při pochybnostech platí `master-roadmap.md`.

| # | Nápad | Verdikt | Kde žije |
|---|---|---|---|
| 1 | **Materiály: statistiky, hvězdičky, ranking učitelů, autorství „test od učitele XX", sdílení (škola/platforma/soukromé) + odměny** | ✅ Přijato — strategicky nejcennější dlouhodobá vertikála (síťový efekt). Odměny = reputace autora (badge, stažení, viditelnost), **ne XP**. | Master roadmap, vertikála 4 — po pilotu (potřebuje kritickou masu učitelů) |
| 1a | AI „podobnost 50 % vůči zadání" | ⏸️ Odloženo — drahé, křehké, nepoptávané. Vrátit se, až marketplace poběží. | Master roadmap, vertikála 4 (poznámka) |
| 2 | **E-mailová upozornění rodičům** („Tomáš vypracoval test", „peníze na výlet do 23. 9.") | ✅ Přijato — reálná bolest škol. Jednosměrná oznámení s potvrzením přečtení, ne chat. | Master roadmap, vertikála 3 — hned po guardianovi (stojí na vazbě z Etapy B) |
| 2a | Propojení notifikací se sociálními sítěmi | ❌ **Zamítnuto trvale** — data dětí + pipeline třetích stran = GDPR riziko a ztráta důvěry škol. Kanály: in-app, e-mail, push. | Guardian doc, princip 7; Master roadmap, princip 3 |
| 3 | **Komunikace přes aplikaci** (GDPR-friendly, info od třídních — sešity na předměty…) | ✅ Přijato v rozsahu oznámení (viz #2). Plný messaging učitel–rodič až podle poptávky z pilotu. | Master roadmap, vertikála 3 |
| 4 | **Žák: výběr mazlíčka + evoluce „od malého kreténa po tygra"** | ✅ Přijato — Fáze 1+2 Parťák 2.0. Druhy čistě vizuální, žádná herní výhoda. | `docs/roadmap/partak-2.0.md`, F1+F2 — po pilotu (brána: 5 otázek) |
| 4a | „Samolepka za úroveň — každej bude vědět" | 🔄 Přijato v upravené podobě — soukromé sběratelské album; **chlubení je akt dítěte, systém nikdy nesrovnává**. Veřejná viditelnost úrovní zamítnuta (žebříček v převleku). | Parťák 2.0, F3 + červená čára 3 |
| 4b | Business — „krabice", fyzické odměny | ✅ Přijato — skutečné samolepky, kartičky evolucí, plyšák; **platí výhradně dospělí**, dítě nikdy nevidí obchod. Prodej XP zamítnut trvale. | Parťák 2.0, F4 + červené čáry 1 a 6 |
| 5 | **Medián a modus** v analytice známek/cvičení | ✅ Přijato — odborně správně (odolné vůči extrémům), malá věc. | Master roadmap, „Průběžné" — kdykoli jako výplň |
| 5a | „Lepší/horší žák v %" (percentil) | ❌ **Zamítnuto trvale** — srovnávání dětí mezi sebou, kolize se základním principem. Žák se srovnává jen se svou vlastní minulostí (trend, zlepšení — existuje). | Master roadmap, „Zamítnuto trvale" |
| 6 | **Domácí procvičování s rodičem → příprava na přijímačky, doporučení gymplu** | ✅ Přijato jako dlouhá vize — největší B2C potenciál. Vyžaduje practice mode (answer key), knihovnu dle RVP (krmí ji #1), doporučování. | Master roadmap, vertikála 8 — projektový dokument až po startu vertikály 4 |
| 7 | **Zjednodušení pro rodiče s nižší gramotností + víc detailu pro schopnější** | ✅ Přijato — basic zobrazení default pro všechny, „Zobrazit více podrobností" jako preference; mění jen prezentaci, nikdy oprávnění. | Guardian doc, Etapa B (body 3, 4 specifikace) |
| 7a | „Žák a rodič dohromady jako profil?" | ❌ **Zamítnuto trvale** — oddělené identity jsou základní princip guardian projektu (provenance jinak ztrácí smysl). Rodinný prostor je UI vrstva, ne společný účet. | Guardian doc, princip 1 |

## Souhrn pořadí (viz master roadmap)
Dokončit PR frontu → Guardian A–D → **Pilot** → Notifikace (#2, #3) → Materiály (#1) → Parťák 2.0 (#4) → … → Practice/přijímačky (#6).

*Tento soubor patří do `docs/roadmap/2026-07-napadnik.md`. Nové nápady = nový záznam, staré verdikty se nepřepisují bez revize v master roadmapě.*