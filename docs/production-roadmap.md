# SkillStorm Production Readiness Roadmap

Datum aktualizace: 2026-06-10

Aktuální verdikt: READY FOR PRE-PROD

## 1. Tenant isolation / RBAC testy

* Endpoint-by-endpoint IDOR testy pro organizace, třídy, studenty, testy, assignmenty, submissions, audit, import/export.
* Role matrix testy pro platform role i organization role.
* Negativní testy pro cross-tenant přístup.

## 2. Lint cleanup po kategoriích

* Nejprve mechanický Prettier cleanup backendu.
* Poté unused imports/vars.
* Poté frontend explicit return type pravidla a hook dependency warnings.
* Nakonec zapnout lint jako blocking CI gate.

## 3. E2E workflow testy

* School happy path: owner/director setup -> teacher creates test -> assignment -> student submission -> result -> analytics.
* Auth refresh/logout/regression flow.
* Import studentů včetně chybových CSV řádků.
* Subscription/suspended organization gating.

## 4. Monitoring, backup, release checklist

* Sentry nebo ekvivalent pro backend/frontend chyby.
* Health/metrics provozní dashboard.
* PostgreSQL backup a restore smoke test.
* Migration runbook a rollback postup.
* Release checklist pro secrets, env, Docker image tags, migrations, seed policy a smoke test.

## 5. P1 datové invarianty

* Sjednotit auth/token model: hash semantics pro refresh token storage a jasná access-token revokace.
* DB nebo aplikační invariant pro uživatele s alespoň jedním login identifikátorem.
* Enum/invarianty pro assignment `targetType` a `showExplain`.
* Audit coverage pro assignment, submission, import/export, invite, subscription a academic year.
* Content scope/subscription compatibility invarianty a regresní testy.
