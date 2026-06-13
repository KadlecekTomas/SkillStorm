# Google SSO architektura — SkillStorm

Datum: 2026-06-13
Stav: PILOT ID-TOKEN VERIFICATION FLOW (vědomé rozhodnutí, viz níže)
Feature flag: `GOOGLE_SSO_ENABLED` (default **false** → endpoint vrací 404 a je nerozlišitelný od neexistující routy)

## 1. Jaký flow je implementovaný a proč

**Implementováno: pilot ID-token verification flow.**

```
Browser (Google Identity Services / One Tap)
   │  získá jednorázový Google ID token (JWT)
   ▼
POST /auth/sso/google  { idToken, organizationId? }
   │  backend token POUZE ověří (issuer, audience, expirace, email_verified)
   ▼
identity match / e-mail link / org-scoped auto-provision
   ▼
standardní SkillStorm session (httpOnly cookies ss_at / ss_rt + ss_csrf)
```

**Toto NENÍ plné enterprise production SSO.** Plná produkční varianta je backend-first authorization-code flow (`GET /auth/sso/google/start` → Google → `GET /auth/sso/google/callback` se state/nonce, client secret výhradně na backendu). Ten v této iteraci implementovaný není.

Proč je pilot flow zvolen:

* Nevyžaduje client secret — backend žádný Google secret nedrží, nemá co uniknout.
* Žádné Google access/refresh tokeny se nezískávají ani neukládají (nepotřebujeme Google API, jen autentizaci).
* Menší attack surface pro pilot: jeden endpoint, server-side verifikace, feature flag.
* Upgrade na authorization-code flow je aditivní (přidání /start a /callback), identity vrstva (UserIdentity, policy, audit) zůstává beze změny.

Bezpečnostní pravidla pilot flow (závazná):

1. Frontend Google token nikam neukládá (žádné localStorage/sessionStorage/cookie) — token se jednorázově POSTne a zahodí.
2. Backend ID token pouze ověří; nikdy ho neukládá, neloguje a nevrací.
3. Backend nevytváří žádnou Google session a nevolá žádné Google API kromě verifikace tokenu.
4. Endpoint je defaultně dark (`GOOGLE_SSO_ENABLED=false` → 404).
5. Rate limit 10 požadavků / 15 min / IP (`@Throttle`).
6. Produkční enterprise nasazení = přechod na start/callback authorization-code flow (BLOCKER pro „READY FOR PRODUCTION“ SSO).

## 2. Endpoints

| Endpoint | Stav |
|---|---|
| `POST /auth/sso/google` `{ idToken, organizationId? }` | implementováno, za flagem |
| `GET /auth/sso/google/start` | neimplementováno (production upgrade path) |
| `GET /auth/sso/google/callback` | neimplementováno (production upgrade path) |

Pozn.: `/auth/sso/google` je v CSRF middleware na seznamu auth-bootstrap výjimek (stejně jako `/auth/login`) — prohlížeč před přihlášením CSRF cookie nemá. Login-CSRF riziko je mitigováno tím, že požadavek vyžaduje platný Google ID token; útočník bez tokenu oběti session nevyrobí.

## 3. Env proměnné

| Proměnná | Význam | Default |
|---|---|---|
| `GOOGLE_SSO_ENABLED` | zapíná endpoint (`'true'`) | false (dark) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web client ID — očekávaná `aud` ID tokenu | prázdné |

Žádný `GOOGLE_CLIENT_SECRET` neexistuje — pilot flow ho nepotřebuje.

## 4. Verifikace tokenu (`GoogleTokenVerifier`)

* Google `tokeninfo` endpoint (server-side); injectable — výměna za `google-auth-library` (offline verifikace podpisu) bez zásahu do služby.
* Kontroluje: issuer ∈ {accounts.google.com, https://accounts.google.com}, `aud === GOOGLE_CLIENT_ID`, expirace, přítomnost `sub`.
* Služba navíc vyžaduje `email_verified === true` a přítomný e-mail.

## 5. Identity model a membership policy

**Identita je globální, přístup je membership.**

* `UserIdentity`: max. jedna identita na (user, provider); `(provider, providerSubject)` globálně unikátní. `organization_id` na identitě je **pouze provenance** (která organizace identitu připustila/provisionovala — audit + GDPR scoping). Nikdy neomezuje, kam se uživatel přihlásí.
* Přístup do organizace určuje výhradně živý `Membership` (vynucováno v `AuthService.resolveSessionMembership` a znovu při každém požadavku v JWT strategy).

Výběr organizace při SSO loginu je **explicitní** (žádné „vezmu první membership“):

| Vstup | Výsledek |
|---|---|
| `organizationId` zadané | uživatel musí mít živý membership, jinak 401 + audit `SSO_MEMBERSHIP_REQUIRED_FAILED` |
| bez `organizationId`, 0 membershipů | personal session (PRIVATE účty, čerstvě provisionovaní) |
| bez `organizationId`, 1 membership | jednoznačné → použije se |
| bez `organizationId`, ≥2 membershipy | 400 `SSO_ORG_SELECTION_REQUIRED` + audit |

Multi-organization user: stejná Google identita se přihlásí do org A i org B — pokaždé s explicitním `organizationId` a platným membershipem; do org C bez membershipu selže. (Pokryto unit testy v `google-sso.service.spec.ts`.)

## 6. Org SSO policy (`OrganizationSettings`)

| Pole | Význam |
|---|---|
| `ssoProvider` | string sloupec; **jediná podporovaná hodnota je `'google'`** (`SUPPORTED_SSO_PROVIDERS` + `isSupportedSsoProvider()`); cokoliv jiného („googleeee“, „admin“, „*“) = SSO vypnuté |
| `sso_allowed_domains` | allowlist e-mailových domén; uplatní se jen při org-scoped loginu (admise identity), ne při pozdějším loginu už propojené identity — autentizace ≠ admise |
| `sso_auto_provision` | default false; `true` dovolí založit lokální účet bez membershipu |

Správa těchto polí zatím nemá API endpoint (nastavuje se interním toolingem/DB). Až vznikne, musí být chráněna stejnou politikou jako ostatní org administrace (OWNER/DIRECTOR/SUPERADMIN) a auditována akcí `SSO_PROVIDER_CONFIG_UPDATED`. Do té doby je to PRODUCT gap, ne security hole (žádná cesta, jak to změnit přes API).

## 7. Auto-provisioning policy

* Default **false**; zapíná se per organizace.
* Vytvoří POUZE lokální účet + identitu — **žádný membership, žádný přístup do organizace**. Role/přístup vzniká výhradně přes invite/import flow.
* Provisioned účet má bcrypt hash 256bit náhodného tajemství → lokální login heslem je fakticky nemožný, dokud uživatel neprojde standardním password resetem.
* Pro žáky se auto-provisioning **nedoporučuje** (děti — viz GDPR doc); určeno primárně pro učitele/zaměstnance s doménovým allowlistem.

## 8. Audit akce

| Akce | Kdy |
|---|---|
| `SSO_LOGIN_GOOGLE` | úspěšný SSO login (vč. po linknutí/provisionu) |
| `SSO_IDENTITY_LINKED_GOOGLE` | propojení identity s existujícím účtem |
| `SSO_USER_PROVISIONED_GOOGLE` | auto-provision účtu |
| `SSO_INVALID_TOKEN` | neplatný/neověřený token, neověřený e-mail |
| `SSO_DOMAIN_MISMATCH_GOOGLE` | e-mail mimo allowlist organizace |
| `SSO_MEMBERSHIP_REQUIRED_FAILED` | chybějící membership / vynucený výběr organizace |
| `SSO_LOGIN_GOOGLE_FAILED` | ostatní selhání (disabled účet, neznámá identita bez provisioningu, nepodporovaný provider) |
| `SSO_PROVIDER_CONFIG_UPDATED` | rezervováno pro budoucí admin endpoint (zatím neexistuje) |

Vypnutý flag (404) se záměrně neaudituje — endpoint je dark a audit by byl spam vektor. Do auditu se nikdy nezapisuje idToken, access/refresh token, authorization code ani secret (regression test: spec ověřuje, že se token nedostane do audit payloadů).

## 9. Co chybí do plného production SSO

1. Backend-first authorization-code flow (/start, /callback, state single-use + expirace, nonce).
2. Admin API + UI pro SSO policy organizace (RBAC: OWNER/DIRECTOR/SUPERADMIN, audit `SSO_PROVIDER_CONFIG_UPDATED`).
3. Self-service odpojení identity v nastavení účtu.
4. `google-auth-library` offline verifikace podpisu místo tokeninfo endpointu.
5. Frontend tlačítko/flow (zatím není — endpoint je připravená serverová vrstva).
6. E2E test SSO flow proti reálné DB (unit vrstva je pokrytá, integrační test vyžaduje test harness).
