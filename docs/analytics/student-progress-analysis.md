# SkillStorm — Student Progress Analysis (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** původní analytický/RFC návrh student progress a mastery vrstvy  
> **Archived:** 2026-08-07  
> **Current data authority:** [`../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md`](../interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)

---

## Archive notice

Původní analýza vznikla před současným rozdělením na curriculum mapping, delivery progress, learning evidence a mastery. Obsahovala dobové návrhy metrik, scoringu, modelů a UI, které už nesmí být považovány za cílovou architekturu.

Kompletní původní text zůstává v Git historii tohoto souboru.

---

## Současný model významu

Nová práce musí vycházet z Current Curriculum Data Contractu, zejména z oddělení:

```text
content coverage
mapping completeness
delivery progress
learning evidence / mastery
```

Tyto dimenze se nesmí sloučit do jednoho neurčitého `progress` skóre.

Learning evidence musí být rekonstruovatelné vůči immutable content/activity a curriculum context version. Completion, time-on-task nebo počet kliknutí samy o sobě nejsou mastery.

---

## Co nepřebírat bez nové revize

- staré mastery formule nebo thresholdy;
- staré názvy Prisma modelů;
- navržené materialized views;
- staré API routes/payloads;
- UX procenta bez definovaného numerator/denominator;
- test counts a performance numbers;
- Eduto-era product framing.

Pro pořadí dalšího analytics/evidence vývoje použijte [`../roadmap/master.md`](../roadmap/master.md).

> **Archive invariant:** historický analytics návrh není implementační specifikace; nové student-progress tvrzení musí mít explicitní evidence semantics a current curriculum provenance.