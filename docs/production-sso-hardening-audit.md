# SkillStorm — Production SSO Hardening Audit (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** audit SSO hardeningu konkrétní starší implementace  
> **Archived:** 2026-08-07  
> **Current technical contract:** [`google-sso-architecture.md`](./google-sso-architecture.md)  
> **Current privacy contract:** [`gdpr-sso-identity.md`](./gdpr-sso-identity.md)

---

## Archive notice

Původní audit zachycoval stav Google SSO v konkrétním okamžiku vývoje. Od té doby se current dokumentace zpřesnila a výslovně klasifikuje existující Google path jako:

```text
CURRENT / IMPLEMENTED — PILOT ONLY
```

nikoli production enterprise SSO.

Aby starý audit nemohl být použit jako důkaz dnešní readiness nebo jako návod k pouhému zapnutí feature flagu, je na aktivní větvi ponechán pouze tento archivní ukazatel. Plný původní text zůstává v Git historii.

---

## Současný zdroj pravdy

Před jakoukoli SSO změnou nebo školním rolloutem čtěte:

- [`google-sso-architecture.md`](./google-sso-architecture.md) — skutečně implementovaný pilot + explicitní blockers pro production OIDC;
- [`gdpr-sso-identity.md`](./gdpr-sso-identity.md) — technický privacy/compliance gate;
- [`tenant-rbac-test-matrix.md`](./tenant-rbac-test-matrix.md) — membership/tenant security;
- aktuální `server/src/auth/` implementaci a E2E/security testy.

### Současný invariant

> Google identity může prokázat identitu uživatele; přístup do školy určuje pouze live SkillStorm Membership + RBAC. Současný ID-token endpoint není production enterprise SSO.

---

## Co nepřebírat z historického auditu

Bez nového ověření nepřebírejte:

- staré readiness verdicts;
- provider-flow doporučení;
- endpoint seznam;
- env variables;
- test counts;
- role/provisioning assumptions;
- právní/compliance závěry.

> **Archive invariant:** historický SSO audit vysvětluje minulost; současnou readiness lze tvrdit pouze podle current contracts a executable evidence.