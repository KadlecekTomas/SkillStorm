# Production SSO hardening audit — SkillStorm

Datum: 2026-06-13
Branch: `feat/google-sso-identity` (uncommitted working tree)
Auditor: production-readiness review této větve + celé aplikace

## Verdict

**READY FOR INTERNAL PILOT** (SSO část), aplikace jako celek zůstává **READY FOR PRE-PROD** dle `production-audit.md` s trvajícími P0 blockery (lint gate, integrační test harness).

Google SSO je **pilot ID-token verification flow**, ne enterprise production SSO — viz `docs/google-sso-architecture.md`. Bez backend-first authorization-code flow nesmí být prezentováno jako plné produkční SSO.

---

## Část 1 — Audit aktuálního diffu

### Změněné soubory a rizika

| Soubor | Co mění | Riziko | Verdikt |
|---|---|---|---|
| `server/prisma/schema.prisma` | +`UserIdentity`, +`IdentityProvider`, +`sso_allowed_domains`/`sso_auto_provision`, doc-komentář „identity is global, access is membership“ | aditivní, žádná destrukce dat | BEZPEČNÉ |
| `server/prisma/migrations/20260612221217_add_user_identity_sso/` | CREATE TYPE/TABLE/INDEX/FK + ADD COLUMN s defaulty | aditivní; **obsahuje drift cleanup nesouvisející se SSO** (catalog_subjects/topics `DROP DEFAULT` na `updated_at`, rename indexu) — viz poznámka níže | BEZPEČNÉ s poznámkou |
| `server/src/auth/auth.service.ts` | ownership+deletedAt check v `issueTokensForMembership`; extrakce `resolveSessionMembership` (behavior-preserving refactor `login()`); nový `issueSessionForVerifiedUser` | dotýká se lokálního loginu — ověřeno: selekce membershipu je identická (stejné 3 kroky, stejné pořadí, stejné výjimky); typecheck + session spec testy | BEZPEČNÉ |
| `server/src/auth/auth.controller.ts` | +`POST /auth/sso/google`; loguje jen `error.message`, nikdy token | nový public endpoint za feature flagem | BEZPEČNÉ |
| `server/src/auth/auth.module.ts` | wiring GoogleSsoService + GoogleTokenVerifier | žádné | BEZPEČNÉ |
| `server/src/auth/sso/*` | verifier + SSO služba (nové soubory) | hlavní nová logika; pokryto 24 unit testy | BEZPEČNÉ |
| `server/src/auth/dto/google-sso.dto.ts` | DTO s class-validator (`@IsString @MaxLength(4096)`, `@IsUUID` optional) | žádné | BEZPEČNÉ |
| `server/src/privacy/privacy.service.ts` | anonymizace: +tokenVersion increment, +refresh token revoke, +identity hard-delete | rozšiřuje transakci o 2 operace; testy | BEZPEČNÉ |
| `server/src/main.ts` | CSRF bootstrap výjimka pro `/auth/sso/google` | login-CSRF mitigace: požadavek vyžaduje platný Google ID token | BEZPEČNÉ (dokumentováno) |
| `server/.env.example` | `GOOGLE_SSO_ENABLED=false`, `GOOGLE_CLIENT_ID=` (prázdné) | žádná tajemství | BEZPEČNÉ |
| `docs/*` | gdpr-sso-identity, google-sso-architecture, tento dokument, production-audit addendum | n/a | BEZPEČNÉ |

### Nálezy z diffu (a jejich řešení)

1. **FIXED (kritické, funkční):** `POST /auth/sso/google` nebyl v CSRF bootstrap výjimkách → čerstvý prohlížeč bez `ss_csrf` cookie by dostal 403 a SSO login by nikdy neprošel. Přidán do exempt listu v `main.ts` se zdůvodněním.
2. **FIXED (bod B):** SSO login bez `organizationId` u multi-membership uživatele dříve spadl do `resolveSessionMembership` fallbacku „lastActive → první membership“. Nyní: 0 membershipů = personal session, 1 = jednoznačný, ≥2 = `400 SSO_ORG_SELECTION_REQUIRED` + audit. Testy přidány.
3. **FIXED (bod D):** `ssoProvider` je volný string sloupec; konzumace nyní jde výhradně přes `SUPPORTED_SSO_PROVIDERS`/`isSupportedSsoProvider()` — „googleeee“, „admin“, „*“ = SSO vypnuté. Test parametrizovaně pokrývá invalid hodnoty. (Sloupec zůstává string — změna na DB enum by byla riziková migrace bez přínosu; žádný API writer zatím neexistuje.)
4. **FIXED (bod G):** doplněny failure audit akce `SSO_INVALID_TOKEN`, `SSO_DOMAIN_MISMATCH_GOOGLE`, `SSO_MEMBERSHIP_REQUIRED_FAILED`, `SSO_LOGIN_GOOGLE_FAILED`. Audit zápis nikdy nemaskuje původní chybu (try/catch) a nikdy neobsahuje token (regression assert v `afterEach` spec souboru).
5. **ROZHODNUTO (bod C):** `UserIdentity.organization_id` PONECHÁNO jako provenance (která org identitu připustila/provisionovala) — explicitně zdokumentováno v schema doc-komentáři + architecture doc, že identita je globální a NIKDY neomezuje, kam se uživatel přihlásí (přístup = Membership). Multi-org chování pokryto testy (org A ✓, org B ✓, org C bez membershipu ✗).
6. **ROZHODNUTO (bod A):** zůstává pilot ID-token flow, výslovně označený a zdokumentovaný vč. závazných bezpečnostních pravidel a upgrade path (`docs/google-sso-architecture.md`). Start/callback authorization-code flow je BLOCKER pro „production SSO“ label.
7. **POZNÁMKA (migrace):** migrace obsahuje drift statements ke `catalog_subjects/catalog_topics` (`DROP DEFAULT` na `updated_at`, rename indexu) — vygenerováno `prisma migrate dev` z dřívějšího schema driftu, není to součást SSO změny. Je to bezpečné (Prisma spravuje `updatedAt` client-side; rename je kosmetický) a uvádí DB do souladu se schématem, ale commit message migrace to musí zmínit. Ověřeno `prisma migrate status`: up-to-date.
8. **Žádná tajemství v diffu:** grep diffu na secret/token/password/client_secret — pouze názvy proměnných a testovací konstanty; `.env.example` má `GOOGLE_CLIENT_ID=` prázdné (client ID navíc není secret); žádná reálná doména kromě příkladové `skola.cz` v testech/docs.

---

## Část 2 — Produkční audit celé aplikace

Legenda: důkaz = soubor/příkaz, kterým lze tvrzení ověřit.

### 1. Auth/session

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Lokální login (status, deletedAt, bcrypt) | PASS | `auth.service.ts login()`: ACTIVE check, deletedAt check, bcrypt.compare; generická chybová hláška |
| Refresh flow + rotace | PASS | `rotateRefreshToken`: hash lookup, expirace, revokace starého, nový pár; tokeny v DB jen jako sha256 hash (`token.util.ts`, spec PASS) |
| Logout/revoke | PASS | `logout()` audituje `LOGOUT` (auth.service.ts:1075), maže cookies, revokuje |
| tokenVersion invalidace | PASS | `jwt.strategy.ts`: mismatch → 401; + `passwordChangedAt` iat check |
| Access 15m / refresh 7d | PASS | `generateTokens` `expiresIn: '15m'`; `issueRefreshToken` `addDays(7)`; cookie maxAge odpovídají |
| Anonymizovaný/smazaný user nemá platnou session | PASS (nově) | `privacy.service.ts`: tokenVersion increment + refresh revoke v transakci anonymizace; spec `privacy.service.spec.ts` |
| User bez passwordHash se nepřihlásí heslem | PASS | `User.passwordHash` je povinný sloupec (schema); provisioned účty mají bcrypt hash 256bit náhodného tajemství (spec ověřuje formát hashe); bcrypt.compare s čímkoliv jiným selže |
| Session bez membershipu jen kde je to legitimní | PASS (nově) | SSO: explicitní pravidlo 0/1/≥2 membershipů (`issueScopedSession` + spec); lokální login: deterministický fallback zachován (pre-existing chování, mimo scope měnit) |
| `issueTokensForMembership` ownership | PASS (nově) | ownership + deletedAt check; spec `auth.service.session.spec.ts` (IDOR test) |

### 2. Tenant isolation

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Cross-org data | PASS s výhradou | e2e suites `tenant-scope-fortress.e2e-spec.ts`, `submissions-student-isolation.e2e-spec.ts`, `test-flow-hardening.e2e-spec.ts` (cross-org 403/404, student isolation) — **lokálně nespustitelné bez test DB harnessu** (viz Testy), důkaz je v kódu testů + CI historii větve `test/tenant-rbac-isolation` |
| organizationId z body se netrustuje | PASS | login/SSO: membership lookup `{userId, organizationId, deletedAt:null}` jinak 401; org data endpoints přes `OrgContextService` (např. `imports.controller.ts`) |
| SUPERADMIN výjimky explicitní | PASS | platform vrstva `@RequireSystemRole`/`PlatformAccessGuard` (memory + `server/src/common/guards/`) |

### 3. RBAC

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Guards skutečně kontrolují role | PASS | `jwt.strategy` re-validuje membership při každém requestu; `roles.guard.ts`, `PlatformAccessGuard`, `@RequireSystemRole` |
| SSO config správa RBAC | N/A (gap) | žádný API endpoint pro zápis `ssoProvider`/`sso_allowed_domains`/`sso_auto_provision` neexistuje (grep: jediný writer není) → nelze obejít; až vznikne, musí mít OWNER/DIRECTOR/SUPERADMIN + audit. PRODUCT gap, ne security hole |
| TEACHER/STUDENT nemůže měnit SSO config | PASS (vacuously) | viz výše — neexistuje endpoint |

### 4. Prisma/database

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Schema + migrace validní | PASS | `npx prisma validate` PASS, `migrate status` up-to-date |
| Migrace neztrácí data | PASS | čistě aditivní (CREATE/ADD COLUMN s defaulty); drift část jen DROP DEFAULT/rename |
| Unikátní indexy | PASS | `(provider, providerSubject)` globální identita; `(userId, provider)` jedna identita na uživatele a provider |
| Soft-delete konzistence | PASS | `deletedAt` checks v auth/membership/SSO cestách; identity se mažou hard (PII) |
| Refresh tokeny bezpečně | PASS | sha256 hash v DB, nikdy plaintext |
| `$queryRawUnsafe` | PASS s poznámkou | jediný výskyt `catalog.service.ts` — parametrizovaný ($1/$2/$3, hodnoty předávané jako argumenty), unsafe jen kvůli `unaccent()`; žádná interpolace vstupu |

### 5. Input validation

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Global ValidationPipe whitelist+forbidNonWhitelisted | PASS | `main.ts:202-205`, `create-app.ts:19-21` |
| SSO DTO | PASS | `google-sso.dto.ts`: `@IsString @IsNotEmpty @MaxLength(4096)` idToken, `@IsUUID` organizationId |
| Provider hodnoty omezené | PASS (nově) | `SUPPORTED_SSO_PROVIDERS` + parametrizovaný test |

### 6. CORS/cookies/CSRF

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| CORS allowlist, ne wildcard s credentials | PASS | `buildCorsOrigin` (bootstrap.utils.ts:75-96): explicit allowlist, dev-only localhost regex |
| Cookies httpOnly + secure(prod) + SameSite=lax | PASS | `token-cookies.ts` |
| CSRF double-submit | PASS | `main.ts` middleware; `DISABLE_CSRF=1` zakázané v produkci (env validace dle production-audit) |
| SSO endpoint CSRF | PASS (nově) | bootstrap výjimka + zdůvodnění (vyžaduje platný Google token); bez výjimky byl endpoint nefunkční |

### 7. Security headers/runtime

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| helmet/security headers | **WARN** | grep: helmet není v src ani package.json. API-only backend za Next frontendem — doporučeno přidat (P1, jeden řádek + dep), nedělám v této větvi (scope) |
| Body limit | PASS (default) | Nest/express default 100kb JSON limit; SSO DTO navíc MaxLength 4096 |
| Error handling | PASS | `AllExceptionsFilter` globálně (main.ts); Prisma chyby mapované (`mapPrismaError`) |
| Logy bez secrets | PASS s poznámkou | SSO cesty logují jen reason/userId; pre-existing: login log obsahuje e-mail (PII v logu — WARN, pre-existing pattern) |
| Swagger v produkci | PASS | `isSwaggerEnabled()`: v produkci jen s explicitním `ENABLE_SWAGGER` |

### 8. Frontend

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Tokeny v localStorage | PASS | `skillstorm_auth` = `{ org }` kontext (client.ts:128-130), žádné tokeny; auth je httpOnly cookies |
| Google tokeny ve FE | PASS (vacuously) | klient žádný SSO kód nemá (grep GOOGLE_* v client/src: 0) — FE flow je teprve follow-up |
| XSS | PASS | žádný `dangerouslySetInnerHTML` v client/src |
| `NEXT_PUBLIC_*` tajemství | PASS | jen `NEXT_PUBLIC_BETA_MODE` badge |
| 401/403 handling | PASS | guard chain + `useAuth` (pre-existing, beze změny) |

### 9. Import/export

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Import tenant-scoped | PASS | `imports.controller.ts` přes `OrgContextService` + academic-year guards |
| Import × budoucí SSO linking | PASS | import vytváří účty s e-mailem → SSO link jde přes verified e-mail match; domain allowlist kompatibilní s `domainAlias` konvencí |
| `forceResetOnFirstLogin` | **WARN** | pole existuje v schema, ale grep nenašel žádné vynucení v src — pre-existing gap, eviduji (P1) |

### 10. Subscription/plans

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| maxUsers enforcement | **WARN** | `maxUsers` jen v schema (řádek 345), žádné vynucení v src — pre-existing gap (P1, shodné s production-audit „slabá modelová konzistence subscription“) |
| SSO jako plan feature flag | N/A | vědomě mimo scope; SSO je per-org policy, plan gating je produktové rozhodnutí |

### 11. Audit logging

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Login success / logout / refresh | PASS | akce LOGIN/LOGOUT/REFRESH v auth.service |
| Login failure | WARN | lokální login failure jen do app logu (logger.warn), ne do audit tabulky — pre-existing; SSO failures nově auditované |
| Anonymizace | PASS | `USER_ANONYMIZED` |
| SSO akce | PASS (nově) | úspěch i selhání, viz architecture doc §8; spec ověřuje, že token není v audit payloadu |
| Žádné tokeny v auditu | PASS (nově) | regression assert v `google-sso.service.spec.ts` afterEach |

### 12. DevOps/production

| Kontrola | Verdikt | Důkaz |
|---|---|---|
| Env fail-fast | PASS | `validateEnvironment()` (bootstrap.utils.ts:9+): produkce vyžaduje JWT secrets atd.; `runProductionEnvCheck` |
| `.env.example` | PASS | placeholdery, žádná tajemství; SSO vars přidány s defaultem off |
| Prisma validate/generate/migrate status | PASS | spuštěno, viz Testy/build |
| Server build | PASS | `nest build` (prebuild: generate + typecheck) |
| Monitoring | PASS (základ) | `initSentryIfConfigured()` v bootstrapu |
| Backup/restore docs | WARN | pre-existing gap dle production-audit (P1) |

---

## Část 3 — Testy/build důkazy (této iterace)

| Příkaz | Výsledek |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS (up-to-date) |
| `npm run typecheck` (server) | PASS |
| `npm run build` (server) | PASS |
| `npm run typecheck` (client) | PASS |
| cílené suites: `google-sso.service.spec` + `google-token.verifier.spec` + `privacy.service.spec` + `auth.service.session.spec` + `token.util.spec` | **5 suites, 46/46 PASS** |
| plný `test:unit:light` | 12 suites failed — **identické failures na čistém stromě** (integrační specs vyžadují e2e DB schéma/`.env.test` harness: auth.policy, org-operation-decorator.enforcement, env-validation, stats/classroom/tests/enrollments/submissions/academic-years); nové změny žádný nový fail nepřidávají |

## Část 4 — Zbývající blockery

**TECHNICAL BLOCKERS (pre-existing, mimo tuto větev):**
* Lint gate červený (server 1112 errors) — viz production-audit P0.
* Integrační/e2e suites lokálně nespustitelné bez `.env.test` + test DB harness; tenant izolace tak má lokálně jen kódový důkaz.

**SECURITY BLOCKERS:** žádný nový. (helmet WARN = P1 doporučení, ne blocker pro pilot.)

**COMPLIANCE BLOCKERS:**
* Právní titul SSO zpracování + DPA dodatek se školami musí potvrdit DPO/právník před zapnutím flagu (viz gdpr-sso-identity.md). Pro děti/žáky zvýšená opatrnost — auto-provisioning pro žáky nedoporučen.

**PRODUCT BLOCKERS (pro „production SSO“ label):**
* Authorization-code flow (/start, /callback) neexistuje.
* Admin API/UI pro org SSO policy neexistuje.
* FE login tlačítko/flow neexistuje.
* Self-service odpojení identity neexistuje.
