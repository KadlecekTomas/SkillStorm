# SkillStorm — Guardian Project Plan (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** etapový projektový plán Guardian/PARENT funkcionality  
> **Archived:** 2026-08-07  
> **Current source of truth:** [`guardian.md`](./guardian.md)  
> **Security source of truth:** [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md)

---

## Archive notice

Tento soubor zachovává **existenci a historickou identitu** původního Guardian projektu, ale jeho původní dlouhý obsah už není na aktivní větvi ponechán jako zdánlivě současná specifikace.

Původní verze popisovala postupné etapy návrhu rodičovské/guardian funkcionality, včetně starší terminologie, pracovních návrhů a dobového kontextu projektu Eduto/SkillStorm. Po dokončení Guardian hardeningu se část těchto předpokladů stala neaktuální nebo byla nahrazena přesnějšími implementačními a bezpečnostními invarianty.

Plný původní text je nadále dohledatelný v Git historii tohoto souboru.

---

## Co platí dnes

Pro jakoukoli současnou práci používejte výhradně:

- [`guardian.md`](./guardian.md) — aktuální implementovaný Guardian/PARENT kontrakt;
- [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) — tenant/RBAC negativní testovací kontrakt;
- [`roadmap/master.md`](./roadmap/master.md) — pořadí dalšího vývoje;
- [`README.md`](./README.md) — dokumentační precedence.

### Nezpochybnitelný současný princip

> `PARENT` přístup je relationship-scoped. Rodič/guardian smí vidět pouze explicitně propojené dítě a žádný user-specific permission nesmí obejít tuto hranici.

---

## Použití tohoto archivu

Tento soubor lze použít pouze pro:

- dohledání historického rozhodovacího kontextu přes Git history;
- porovnání původního záměru se současným řešením;
- audit vývoje projektu.

Nesmí být použit jako prompt, backlog, Prisma návrh, API kontrakt ani release checklist bez nové revize proti current dokumentaci a kódu.

> **Archive invariant:** historie je zachována v Gitu; současná větev obsahuje pouze bezpečný archivní ukazatel, který nemůže být zaměněn za aktivní specifikaci.