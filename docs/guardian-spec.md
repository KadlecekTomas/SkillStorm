# SkillStorm — Guardian Specification (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** původní technická/funkční specifikace Guardian/PARENT vrstvy  
> **Archived:** 2026-08-07  
> **Current implementation contract:** [`guardian.md`](./guardian.md)  
> **Current security contract:** [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md)

---

## Archive notice

Původní specifikace vznikla před dokončením současného Guardian/PARENT hardeningu. Obsahovala pracovní datové modely, endpointy, flow a bezpečnostní předpoklady platné pro tehdejší stav repozitáře.

Aby nemohla být při přímém otevření zaměněna za dnešní API/RBAC specifikaci, je na aktivní větvi nahrazena tímto archivním ukazatelem. Kompletní původní obsah zůstává dohledatelný v Git historii.

---

## Současná autorita

Pro aktuální implementaci a další změny používejte:

1. [`guardian.md`](./guardian.md) — skutečně implementované identity, relation a PARENT invarianty;
2. [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) — negativní tenant/RBAC evidence a production gate;
3. [`roadmap/master.md`](./roadmap/master.md) — priority;
4. aktuální Prisma schema, migrations, services/controllers a E2E testy.

### Současné bezpečnostní jádro

```text
verified identity
+ live organization Membership
+ PARENT role invariant
+ explicit GuardianStudentRelation
= relation-scoped child access
```

Žádný starý návrh endpointu, role nebo `UserPermission` override z historické specifikace nesmí tento model obejít.

---

## Co z tohoto souboru nepřebírat

Bez nové revize nepřebírejte z Git historie:

- staré Prisma model sketches;
- endpoint paths/status codes;
- permissions/role matrix;
- UI routy;
- migration pořadí;
- staré test counts;
- Eduto-era terminology;
- nezrealizované fáze označené tehdy jako plánované.

> **Archive invariant:** tento dokument dokládá historii specifikace, ale dnešní Guardian chování lze tvrdit pouze podle current contractu a executable evidence.