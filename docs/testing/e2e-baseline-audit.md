# SkillStorm — E2E Baseline Audit (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** bodový audit E2E testovacího stavu a suite topology  
> **Archived:** 2026-08-07  
> **Current CI authority:** [`../ci.md`](../ci.md)  
> **Current security-test authority:** [`../tenant-rbac-test-matrix.md`](../tenant-rbac-test-matrix.md)

---

## Archive notice

Původní dokument zachycoval konkrétní počet, stav a rozdělení E2E testů v jednom okamžiku vývoje. Tyto údaje rychle stárnou: testy se přesouvají, nahrazují, karantenizují a mění se workflow, které je skutečně spouští.

Proto aktivní větev obsahuje pouze tento archivní ukazatel. Kompletní původní audit zůstává dohledatelný v Git historii.

---

## Co platí dnes

Release/test evidence se určuje podle:

- aktuálních `.github/workflows/*.yml`;
- [`../ci.md`](../ci.md);
- současných `server/test/e2e/` a Playwright suites;
- [`../tenant-rbac-test-matrix.md`](../tenant-rbac-test-matrix.md) pro negativní security coverage;
- current branch protection / required checks.

### Důležité pravidlo

Test v `e2e-legacy`, quarantine nebo historickém auditu **není release gate**, pokud ho současný CI/release contract výslovně nespouští a nedůvěřuje mu.

Stejně tak starý počet typu „N testů green“ není důkazem současné coverage.

---

## Kdy historický audit použít

Pouze pro:

- porovnání vývoje testovací strategie;
- dohledání důvodu, proč byla suite přesunuta/nahrazena;
- forenzní práci přes Git history.

Pro nový gap založte current test/spec a ověřte ho proti dnešnímu API, schema a CI.

> **Archive invariant:** kvalitu současného releasu dokazují současné executable tests a required checks, ne starý baseline audit.