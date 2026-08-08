# SkillStorm — Query Limits Audit (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** jednorázový audit query patterns/limitů a lokálních benchmarků  
> **Archived:** 2026-08-07  
> **Current operational authority:** [`monitoring.md`](./monitoring.md) · current code/tests/observability

---

## Archive notice

Původní audit obsahoval jednorázové počty ORM query patterns, lokální benchmarky a doporučení platná pro tehdejší HEAD. Tyto hodnoty nejsou production SLO ani současná performance baseline.

Kompletní původní obsah zůstává v Git historii.

---

## Současné performance pravidlo

Performance tvrzení musí být znovu změřeno proti:

```text
aktuálnímu HEAD
reprezentativnímu datasetu
jasně definované infrastruktuře
konkrétnímu endpointu/scénáři
měřenému load modelu
p50/p95/p99 nebo jiné explicitní metrice
```

Statický počet `findMany`, lokální čas jednoho notebooku nebo starý query list nejsou důkazem současného produkčního problému ani současného výkonu.

Pokud se objeví nový performance hotspot, založte current issue/spec s reprodukcí, měřením před/po a regresním/performance gatem odpovídajícím riziku.

> **Archive invariant:** historický benchmark je kontext, ne SLO a ne current optimization backlog.