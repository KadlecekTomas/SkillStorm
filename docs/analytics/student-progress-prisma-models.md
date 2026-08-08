# SkillStorm — Student Progress Prisma Models (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** starší Prisma/model sketch pro analytics/mastery vrstvu  
> **Archived:** 2026-08-07  
> **Current schema authority:** current `server/prisma/schema.prisma` + migrations  
> **Current curriculum/evidence authority:** [`../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)

---

## Archive notice

Tento soubor dříve obsahoval navržené Prisma modely, enumy, indexy a view pro Student Progress. Nikdy se nesmí znovu použít jako copy/paste schema pouze proto, že je detailní.

Od vzniku návrhu se změnilo skutečné Prisma schema i cílové rozdělení odpovědností mezi:

```text
taxonomy
curriculum/versioning
Lesson Experience / Activity
learning evidence
mastery projections
analytics
```

Původní model sketch zůstává dohledatelný v Git historii.

---

## Současné pravidlo pro databázovou změnu

Před přidáním jakéhokoli analytics/evidence modelu:

1. načtěte aktuální Prisma schema a poslední migrations;
2. určete přesnou odpovědnost modelu podle Curriculum Data Contractu;
3. zkontrolujte tenant ownership, versioning a historical integrity;
4. navrhněte additive/reversible migration path;
5. přidejte DB/service/E2E invariant tests;
6. aktualizujte normativní dokumentaci ve stejném PR.

### Zakázané shortcuty

Bez nové architektonické revize nepřebírejte z historického návrhu:

- model/enum names;
- foreign keys;
- uniqueness constraints;
- materialized views;
- mastery scoring columns;
- retention assumptions;
- denormalizované aggregate fields.

> **Archive invariant:** jediným executable schema source of truth je aktuální Prisma + migrations; historický model sketch může vysvětlit minulý návrh, ale nikdy sám neautorizuje migraci.