# SkillStorm — Production Readiness (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** starší production-readiness checklist konkrétního releasu  
> **Archived:** 2026-08-07  
> **Current authority:** [`../README.md`](../README.md) · [`../ci.md`](../ci.md) · [`../tenant-rbac-test-matrix.md`](../tenant-rbac-test-matrix.md)

---

## Archive notice

Původní soubor obsahoval provozní/readiness stav a checklist platný pro tehdejší verzi aplikace. Production readiness je ale vlastnost konkrétního aktuálního releasu a jeho evidence, nikoli trvalá vlastnost Markdownu.

Původní text zůstává zachován v Git historii; na aktivní větvi tento soubor nesmí fungovat jako dnešní release checklist.

---

## Současné release zdroje

Používejte kombinaci:

- [`../ci.md`](../ci.md) a aktuální GitHub Actions;
- [`../tenant-rbac-test-matrix.md`](../tenant-rbac-test-matrix.md);
- [`backup-restore.md`](./backup-restore.md);
- [`monitoring.md`](./monitoring.md);
- [`../google-sso-architecture.md`](../google-sso-architecture.md) a [`../gdpr-sso-identity.md`](../gdpr-sso-identity.md);
- [`../interactive-curriculum/PRODUCTION-CONTRACT.md`](../interactive-curriculum/PRODUCTION-CONTRACT.md) pro nový classroom/activity domain;
- aktuální migrations, security tests a deployment evidence.

Staré checkboxy, env názvy, provider instrukce nebo `READY` verdict z Git historie se nesmí znovu použít bez ověření.

> **Archive invariant:** aktuální school-production release musí prokázat současné gates; starý readiness checklist nic neautorizuje.