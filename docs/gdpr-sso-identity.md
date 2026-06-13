# GDPR & compliance: SSO identity vrstva (Google)

Datum: 2026-06-13 (aktualizováno po hardening auditu)
Stav: připraveno spolu s feature větví `feat/google-sso-identity` (feature je vypnutá, `GOOGLE_SSO_ENABLED=false` výchozí)
Flow: **pilot ID-token verification flow** — viz `docs/google-sso-architecture.md`; nejde o plné enterprise authorization-code SSO.

**Rozsah Google dat: pouze autentizace.** Nepoužívá se Gmail, Drive, Classroom ani žádné jiné Google API či scope. Nezískávají se a neukládají se žádné Google access/refresh tokeny — přijímá se výhradně jednorázový ID token, který se po server-side ověření zahodí (neukládá se, neloguje se, nevrací se).

## 1. Co vrstva dělá

Organization-scoped SSO identita: externí identita (Google) je propojena s lokálním účtem `User` přes tabulku `user_identities`. Organizace řídí svou SSO politiku přes `organization_settings`:

| Pole | Význam |
|---|---|
| `ssoProvider` | `'google'` zapíná Google SSO pro organizaci; jinak je org-scoped přihlášení odmítnuto. |
| `sso_allowed_domains` | Volitelný allowlist e-mailových domén (např. `skola.cz`). Prázdný = bez omezení domény. |
| `sso_auto_provision` | Pouze pokud `true`, smí SSO založit nový lokální účet. Memberships (role v organizaci) se tím NEvytváří — zůstávají na invite flow. |

Endpoint: `POST /auth/sso/google` (`{ idToken, organizationId? }`), gated `GOOGLE_SSO_ENABLED`, rate-limited 10/15 min. ID token se ověřuje výhradně server-side (issuer, audience = `GOOGLE_CLIENT_ID`, expirace, vyžádaný ověřený e-mail).

## 2. Inventář osobních údajů (nová data)

Tabulka `user_identities`:

| Pole | Kategorie | Účel | Zdroj |
|---|---|---|---|
| `provider_subject` (Google `sub`) | identifikátor | stabilní párování identity na účet | Google ID token |
| `email`, `email_verified` | kontaktní údaj | párování s lokálním účtem, audit | Google ID token |
| `display_name` | identifikační údaj | zobrazení v administraci | Google ID token |
| `organization_id` | vazba | org-scoped politika (která organizace identitu připustila) | aplikace |
| `last_used_at` | provozní metadata | bezpečnostní přehled, detekce zneužití | aplikace |

Nezpracováváme: profilové fotky, Google access/refresh tokeny (nikdy se neukládají — přijímáme pouze jednorázový ID token, který se po ověření zahazuje), kontakty, kalendáře ani jiné scopes.

## 3. Právní základ a role

* Pracovní hypotéza právního základu: plnění smlouvy (poskytnutí přihlášení do platformy) čl. 6 odst. 1 písm. b) GDPR; u žáků jedná škola (organizace) jako správce, platforma jako zpracovatel — stejně jako u stávajících účtů. **COMPLIANCE: právní titul a kvalifikaci rolí musí před zapnutím flagu potvrdit DPO/právník — toto je technický dokument, ne právní stanovisko.**
* Google působí jako samostatný správce pro Google účet; mezi platformou a Googlem se předává pouze ID token iniciovaný uživatelem.
* Před zapnutím flagu: doplnit zmínku o SSO do zpracovatelské smlouvy se školami (DPA) a do informace o zpracování (privacy policy).

### Děti a žáci — zvýšená opatrnost

* Žáci jsou děti ve smyslu GDPR; SSO pro žáky smí zapnout pouze škola jako správce v rámci své smlouvy a svého posouzení.
* **Auto-provisioning pro žáky je nedoporučený a default je vypnutý** — žákovské účty mají vznikat řízeně přes import/invite flow školy, ne samovolně z Google přihlášení.
* Doménový allowlist organizace omezuje admisi identit na školní doménu.

### DPIA-lite (hlavní rizika a mitigace)

| Riziko | Mitigace |
|---|---|
| Únik Google identifikátoru (`sub`) + e-mailu | minimalizace polí, hard-delete při anonymizaci, kaskáda při smazání účtu, hashované session tokeny |
| Account-takeover přes podvržený token | server-side verifikace issuer/audience/expirace, vyžadovaný `email_verified`, rate limit, audit failure akcí |
| Nechtěné propojení účtů (e-mail kolize) | link jen přes Google-ověřený e-mail; účty disabled/anonymized se nelinkují; audit `SSO_IDENTITY_LINKED_GOOGLE` |
| Hromadné zakládání účtů (auto-provision) | default off, per-org opt-in, doménový allowlist, rate limit 10/15 min/IP, audit `SSO_USER_PROVISIONED_GOOGLE`, účty bez membershipu nemají žádný org přístup |
| Přihlášení do špatné organizace | explicitní výběr organizace (`SSO_ORG_SELECTION_REQUIRED` při ≥2 membershipech), membership vynucen serverem |

## 4. Práva subjektů údajů

| Právo | Implementace |
|---|---|
| Výmaz / anonymizace | `PrivacyService.anonymizeUser` nyní **hard-deletuje všechny řádky `user_identities`** daného uživatele (SSO subject + e-mail jsou PII a nesmí přežít anonymizaci). Současně inkrementuje `tokenVersion` a revokuje refresh tokeny, takže anonymizací okamžitě zanikají všechny živé sessions. |
| Přístup / přenositelnost | Identity řádky jsou dohledatelné podle `userId`; doporučeno doplnit do budoucího exportního endpointu (viz roadmap). |
| Odvolání souhlasu / odpojení identity | Odpojení Google identity = smazání řádku `user_identities`; lokální účet a heslo zůstávají. Admin UI pro self-service odpojení je follow-up. |

## 5. Retence

* `user_identities` žijí s účtem; zanikají kaskádou při smazání uživatele (`onDelete: Cascade`) a hard-deletem při anonymizaci.
* `last_used_at` je jediná provozní stopa; SSO logins se auditují akcemi `SSO_LOGIN_GOOGLE`, `SSO_IDENTITY_LINKED_GOOGLE`, `SSO_USER_PROVISIONED_GOOGLE` v existujícím audit logu, na který se vztahuje stávající `AuditRetentionService` (anonymizace PII v auditu).

## 6. Bezpečnostní opatření

* Token se ověřuje server-side proti Google (`tokeninfo`), kontroluje se issuer, audience, expirace a `email_verified`. Verifier je injectable — lze jej nahradit lokální verifikací podpisu přes `google-auth-library` bez zásahu do služby.
* Auto-provisioned účty dostávají náhodný 256bit hash hesla → heslem se přihlásit nelze, dokud uživatel neprovede standardní password reset.
* Účty ve stavu jiné než `ACTIVE`, smazané nebo anonymizované se přes SSO přihlásit nemohou (kontrola ve službě i v `issueSessionForVerifiedUser`).
* Chybové odpovědi neprozrazují existenci organizací ani konfiguraci SSO (jednotná `Unauthorized` hláška).
* Vypnutý flag (`GOOGLE_SSO_ENABLED != 'true'`) vrací 404 — endpoint není rozlišitelný od neexistující routy.

## 7. Co zbývá před produkčním zapnutím (checklist)

- [ ] Vyplnit `GOOGLE_CLIENT_ID` (OAuth Web client) v produkčním env a nastavit `GOOGLE_SSO_ENABLED=true`.
- [ ] Aktualizovat privacy policy + DPA dodatek o Google SSO.
- [ ] Admin UI pro správu `ssoProvider` / `sso_allowed_domains` / `sso_auto_provision` per organizace (zatím nastavitelné jen přímo v DB / interním tooling).
- [ ] Self-service odpojení identity v nastavení účtu.
- [ ] Zvážit výměnu tokeninfo verifieru za `google-auth-library` (offline verifikace podpisu, nižší latence, žádný outbound call).
- [ ] Doplnit identity do datového exportu (právo na přístup).
