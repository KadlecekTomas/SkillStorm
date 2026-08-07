# SkillStorm — Google SSO Architecture

> **Status:** `CURRENT / IMPLEMENTED — PILOT ONLY`  
> **Owner:** Engineering + Security  
> **Last verified:** 2026-08-07  
> **Scope:** current Google ID-token verification flow, identity/membership policy, organization SSO policy and explicit production gaps  
> **Implementation authority:** current code under `server/src/auth/` has technical precedence. This document must be updated in the same PR when the SSO contract changes.

---

## 0. Production-readiness statement

The repository currently implements a **feature-flagged Google ID-token verification pilot**.

It is **not** the final enterprise Google Workspace SSO integration and must not be marketed or operated as such.

Current endpoint:

```text
POST /auth/sso/google
```

Current feature flag:

```text
GOOGLE_SSO_ENABLED=false   # default/off unless explicitly enabled
```

When the flag is off, the SSO service intentionally returns `404` so the dark endpoint is not exposed as an enabled capability.

A future enterprise production SSO release requires a separately reviewed backend-first authorization-code/OIDC flow and the production gate in section 11.

---

# 1. Current flow

```text
Browser / Google Identity Services
        ↓ obtains one-shot Google ID token
POST /auth/sso/google { idToken, organizationId? }
        ↓
GoogleTokenVerifier
  - verifies against Google tokeninfo
  - issuer
  - audience == GOOGLE_CLIENT_ID
  - expiry
  - subject
        ↓
GoogleSsoService additionally requires
  - verified e-mail
  - organization policy when organizationId is supplied
        ↓
identity match / verified-email link / explicitly allowed auto-provision
        ↓
standard SkillStorm session
  - httpOnly access/refresh cookies
  - CSRF cookie
```

### Current intentional limits

- no `/auth/sso/google/start` endpoint;
- no `/auth/sso/google/callback` endpoint;
- no Google client secret in the pilot flow;
- no Google access token stored;
- no Google refresh token stored;
- no Google API access beyond token verification;
- no claim that this is production enterprise SSO.

---

# 2. Current endpoint contract

| Endpoint | Status | Notes |
| --- | --- | --- |
| `POST /auth/sso/google` | `IMPLEMENTED / PILOT` | public auth-bootstrap endpoint, gated by `GOOGLE_SSO_ENABLED`; rate limited |
| `GET /auth/sso/google/start` | `NOT IMPLEMENTED` | target production authorization-code/OIDC flow |
| `GET /auth/sso/google/callback` | `NOT IMPLEMENTED` | target production authorization-code/OIDC callback |

The current controller applies:

```text
10 requests / 15 minutes / throttling key configured by Nest throttler
```

The endpoint participates in the same session/cookie issuance path as normal verified-user authentication.

---

# 3. Token handling invariants

The pilot flow has strict token handling rules:

1. The Google ID token is one-shot authentication input.
2. Frontend must not persist the token in `localStorage`, `sessionStorage` or application cookies.
3. Backend must not persist the Google ID token.
4. Backend must not include token material in audit records or application logs.
5. Backend must never return the Google ID token to the client.
6. Google access/refresh tokens are not requested or stored by this pilot.
7. Error logging must contain only coarse authentication context, never credential/token material.

Any future authorization-code flow must define equally explicit handling for authorization codes, state, nonce and any provider tokens.

---

# 4. Verification contract

Current `GoogleTokenVerifier` uses Google's server-side `tokeninfo` endpoint and validates at least:

- issuer is `accounts.google.com` or `https://accounts.google.com`;
- `aud` equals configured `GOOGLE_CLIENT_ID`;
- token has a finite future expiry;
- `sub` exists;
- service layer requires a verified e-mail address.

Current implementation intentionally keeps verification injectable so a later implementation can move to local signature/JWK verification (for example via an appropriate maintained Google/OIDC library) without rewriting identity policy.

### Failure behavior

Verification/configuration failures are authentication failures. The system must not fall back to trusting an unverified e-mail or client-provided identity data.

---

# 5. Identity vs. organization access

Core invariant:

> **Identity is global. Organization access is granted by a live Membership.**

A Google identity proves which global SkillStorm user is authenticating. It does not by itself grant membership, role or permission in a school.

Current `UserIdentity` policy is designed around:

- unique provider subject identity;
- optional organization provenance for the admission/linking event;
- live `Membership` as the authority for organization access.

Client-visible organization selection is never authorization. Membership is resolved/enforced server-side during session issuance and subsequent authenticated requests.

---

# 6. Explicit organization selection

The current login path must not silently choose the first organization for a multi-organization user.

| Input/state | Result |
| --- | --- |
| `organizationId` supplied | user must have a valid live membership for that organization; otherwise authentication fails |
| no `organizationId`, 0 memberships | personal/unscoped session can be issued according to current account policy |
| no `organizationId`, exactly 1 membership | that membership is unambiguous |
| no `organizationId`, 2+ memberships | fail with `SSO_ORG_SELECTION_REQUIRED` |

This rule protects multi-school users from accidentally receiving a session in the wrong tenant context.

---

# 7. Organization SSO policy

Current organization policy is read from organization settings.

Relevant concepts:

```text
ssoProvider
ssoAllowedDomains
ssoAutoProvision
```

### Supported provider value

Current code supports only:

```text
google
```

Arbitrary strings are treated as unsupported/disabled rather than as aliases.

### Domain allowlist

For organization-scoped admission/linking, configured e-mail domains are normalized and checked server-side.

A hosted-domain claim or e-mail domain is not a substitute for membership authorization.

### Auto-provisioning

Default policy is restrictive.

When explicitly enabled for an organization, auto-provisioning may create:

```text
User + UserIdentity
```

It does **not** create an organization membership or assign a role.

Role/membership assignment remains a separate controlled organization workflow.

This is particularly important for schools: successful Google authentication must never automatically make an unknown account a teacher, student, director or owner.

---

# 8. Auto-provisioned local credential

Current auto-provision code creates a random password hash so the newly created user cannot meaningfully use a known local password created by the SSO path.

Local password authentication must become available only through the standard account/password-reset policy if the product allows that transition.

The random secret itself must never be returned, logged or documented.

---

# 9. Audit contract

Current SSO behavior uses coarse audit actions such as:

```text
SSO_LOGIN_GOOGLE
SSO_IDENTITY_LINKED_GOOGLE
SSO_USER_PROVISIONED_GOOGLE
SSO_INVALID_TOKEN
SSO_DOMAIN_MISMATCH_GOOGLE
SSO_MEMBERSHIP_REQUIRED_FAILED
SSO_LOGIN_GOOGLE_FAILED
```

A future organization SSO configuration write path must also be audited.

### Audit data prohibition

Never audit/log:

- Google ID token;
- provider access token;
- provider refresh token;
- authorization code;
- client secret;
- session access/refresh token;
- raw credentials.

The disabled/dark endpoint does not need to create an audit event for every probe; doing so would create an unauthenticated audit-spam path.

---

# 10. School-specific safety rules

Before SSO is enabled for a real school:

```text
[ ] school/tenant identity domain ownership is confirmed
[ ] organization SSO policy is reviewed
[ ] auto-provisioning choice is explicit
[ ] no SSO path grants Membership or OrganizationRole implicitly
[ ] multi-organization selection is tested
[ ] disabled/deleted/anonymized user behavior is tested
[ ] student account policy is reviewed separately from staff policy
[ ] audit/log redaction is tested
[ ] recovery path exists if provider login is unavailable
[ ] break-glass/admin access policy is documented without creating a bypass
```

Do not assume staff and pupil identity lifecycle should use identical provisioning rules.

---

# 11. Blockers for production enterprise Google SSO

The current pilot must not be relabeled `production SSO` until a dedicated implementation/review closes at least these gaps:

1. **Backend-first authorization-code/OIDC flow** with server-generated state and nonce.
2. **Single-use + expiry semantics** for login transaction state/nonce.
3. **Secure callback handling** and exact redirect URI policy.
4. **Production-grade provider-token verification** without using a diagnostic tokeninfo request as the final architecture.
5. **Organization admin API/UI** for SSO configuration with strict RBAC + audit.
6. **Identity lifecycle management**, including safe unlink/relink and account-recovery semantics.
7. **End-to-end tests** for success, invalid state/nonce, wrong audience/issuer, domain mismatch, disabled user, missing membership and multi-org selection.
8. **Provider outage/failure behavior** and operational monitoring.
9. **Privacy/security review** for school/staff/student identity data.
10. **Rollback/disable plan** that does not strand administrators.

The exact production flow should follow the provider's current supported OIDC/OAuth guidance at implementation time and be security-reviewed then; this document intentionally does not freeze a future provider protocol implementation before that work begins.

---

# 12. Current environment variables

Pilot variables:

| Variable | Meaning | Default expectation |
| --- | --- | --- |
| `GOOGLE_SSO_ENABLED` | enables current pilot endpoint when equal to `'true'` | off unless explicitly configured |
| `GOOGLE_CLIENT_ID` | expected OAuth/OIDC Web client ID / ID-token audience | required when pilot is enabled |

The current pilot does not require a `GOOGLE_CLIENT_SECRET` because it does not implement the authorization-code exchange.

A future production code-flow implementation will define a new reviewed secret/configuration contract.

---

# 13. Test requirements for changes

Any SSO change must preserve/add regression coverage for the relevant invariants:

```text
[ ] flag off -> endpoint unavailable/dark behavior
[ ] issuer validation
[ ] audience validation
[ ] expiry validation
[ ] verified e-mail required
[ ] token material absent from logs/audit payloads
[ ] known identity login
[ ] verified e-mail linking policy
[ ] unsupported organization provider rejected
[ ] domain mismatch rejected
[ ] auto-provision off rejected for unknown identity
[ ] auto-provision creates no membership/role
[ ] requested organization requires live membership
[ ] multi-org login requires explicit organization choice
[ ] disabled/deleted/anonymized account rejected
[ ] tenant context cannot be selected by client assertion alone
```

When the authorization-code flow is implemented, its state/nonce/replay/callback tests become release blockers.

---

## Final invariant

> **Google authentication may establish a SkillStorm identity; only SkillStorm's own live tenant membership and RBAC model may establish access to a school. The current Google path remains an explicitly labeled pilot until the production OIDC flow and its security/operations gates are complete.**