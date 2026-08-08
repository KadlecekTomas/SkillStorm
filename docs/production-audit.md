# SkillStorm — Production Audit (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** production audit konkrétního staršího stavu repozitáře  
> **Archived:** 2026-08-07  
> **Current release/security authority:** [`README.md`](./README.md) · [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) · [`ci.md`](./ci.md)

---

## Archive notice

Původní audit obsahoval detailní nálezy, počty testů, cesty, stav migrací a readiness závěry platné pro konkrétní commit a dobu svého vzniku.

Takový dokument je cenný jako historický důkaz, ale nebezpečný jako current checklist: po změně schématu, RBAC, CI, SSO a Interactive Curriculum contracts by část tvrzení působila autoritativně, přestože už nemusí odpovídat současnému HEAD.

Proto je aktivní větev nahrazena tímto archivním ukazatelem. Kompletní původní audit je zachován v Git historii.

---

## Pro současný production audit používejte

- [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) — security evidence a explicitní school-production blockers;
- [`ci.md`](./ci.md) — dnešní CI/release-check semantics;
- [`ops/backup-restore.md`](./ops/backup-restore.md) — recovery readiness;
- [`ops/monitoring.md`](./ops/monitoring.md) — monitoring/alerting;
- [`google-sso-architecture.md`](./google-sso-architecture.md) a [`gdpr-sso-identity.md`](./gdpr-sso-identity.md) — současný SSO pilot boundary;
- [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md) — nové classroom/activity production invarianty;
- aktuální GitHub Actions, migrations a executable tests.

### Zakázaný shortcut

Starý výrok typu `READY`, `BLOCKED`, počet testů, konkrétní SHA, endpoint nebo model z Git historie se nesmí přenést do současného release rozhodnutí bez nového ověření.

> **Archive invariant:** production readiness je stav aktuálního releasu, nikoli vlastnost starého auditního Markdownu.