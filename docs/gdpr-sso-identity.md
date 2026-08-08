# SkillStorm — Google SSO Identity: Privacy & Compliance Contract

> **Status:** `CURRENT / IMPLEMENTED — PILOT ONLY`  
> **Owner:** Engineering + Security + Privacy/Compliance  
> **Last verified:** 2026-08-07  
> **Scope:** personal-data inventory and technical privacy controls of the currently implemented Google ID-token SSO pilot  
> **Related contract:** [`google-sso-architecture.md`](./google-sso-architecture.md)  
> **Legal note:** this is a technical privacy/compliance specification, **not legal advice**. Lawful basis, controller/processor allocation, DPA wording, DPIA necessity and school deployment conditions require review for the actual service arrangement and jurisdiction before production use.

---

## 0. Production-readiness statement

The current Google SSO path is a **feature-flagged pilot**, not production enterprise SSO.

This document must never be read as permission to enable the feature in a school merely because the technical endpoint exists.

Production enablement requires both:

1. the engineering/security blockers in [`google-sso-architecture.md`](./google-sso-architecture.md) to be closed; and
2. a deployment-specific privacy/legal review covering the actual school/service relationship and data flows.

---

# 1. Current Google data scope

The implemented pilot uses Google **only for authentication identity verification**.

Current design does not request or use:

- Gmail;
- Drive;
- Calendar;
- Classroom;
- Contacts;
- Google access tokens for API calls;
- Google refresh tokens.

The browser sends a one-shot Google ID token to the backend. The backend verifies it and must not persist or return that token.

Any future addition of a Google API scope is a **new data-processing purpose and security/privacy review**, not an incremental SSO configuration tweak.

---

# 2. Current identity data inventory

The current identity layer stores data comparable to:

| Data | Purpose in current system | Source |
| --- | --- | --- |
| provider | identify identity provider | SkillStorm |
| Google `sub` / provider subject | stable external identity link | verified Google ID token |
| e-mail | account linking / identity display / operational authentication context | verified Google ID token |
| e-mail verified flag | prevents unverified-email linking | verified Google token response |
| display name | identity/admin presentation where used | verified Google token response |
| organization provenance | records organization context that admitted/provisioned the identity | SkillStorm |
| last-used timestamp | security/operational identity metadata | SkillStorm |

### Explicitly excluded from the pilot identity store

- raw Google ID token;
- Google access token;
- Google refresh token;
- authorization code;
- Google password;
- contacts/calendar/mail data;
- profile photo unless a future separately reviewed feature adds it.

Keep the data inventory synchronized with the actual Prisma model and serialized API responses.

---

# 3. Identity is not school authorization

Privacy and tenant safety share the same core invariant:

> **A Google identity establishes who the user is; a live SkillStorm Membership establishes whether that user may access a school.**

Current SSO auto-provisioning, when explicitly enabled, may create a local user + external identity link.

It must **not** automatically create:

- Membership;
- student status;
- teacher status;
- director/owner role;
- permissions in an organization.

This reduces both unauthorized access risk and accidental personal-data disclosure across tenants.

---

# 4. Organization SSO settings

Current organization policy includes concepts such as:

```text
ssoProvider
ssoAllowedDomains
ssoAutoProvision
```

### Domain allowlist

A school e-mail-domain match is only an admission signal. It is not proof of a current role or membership.

A domain must never become a shortcut such as:

```text
@school.cz -> automatically TEACHER
```

### Auto-provisioning

Auto-provisioning is restrictive by default and should remain explicit per organization.

For pupil accounts, the safer default is managed lifecycle through the school's import/invite/account-management process unless a later reviewed school identity design establishes otherwise.

---

# 5. Children require heightened privacy protection

SkillStorm is intended for schools and therefore processes data about children.

The European Data Protection Board emphasizes that children merit specific protection and that information provided to them should be clear, understandable and age-appropriate.

Authoritative reference:

- `https://www.edpb.europa.eu/topics/key-gdpr-concepts/children_en`

### Product consequences

For pupil SSO/identity flows:

- minimize collected identity attributes;
- avoid unnecessary long-lived external identifiers in client-visible surfaces;
- provide age-appropriate privacy/transparency information where the school/service arrangement requires it;
- do not turn authentication metadata into behavioral/learning profiling;
- do not default to open self-registration into a school tenant;
- do not use consent as a generic fallback lawful basis without deployment-specific legal analysis;
- do not infer that parental consent is automatically the required lawful basis for every school processing activity.

The exact lawful basis and responsibilities must be determined for the actual processing purpose and school arrangement.

---

# 6. Controller / processor roles are deployment-specific legal conclusions

Do not hardcode the legal statement:

```text
school = controller
SkillStorm = processor
```

as universally true for every future SkillStorm processing purpose.

The EDPB defines a controller by who determines the purposes and means of processing; a processor acts on the controller's instructions. Different SkillStorm features may need separate analysis depending on who determines the processing purpose.

Reference:

- `https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en`

Before production school deployment, privacy/legal review must document at minimum:

```text
processing purpose
categories of data subjects
categories of personal data
lawful basis / legal authority as applicable
controller / processor / joint-controller allocation
sub-processors and transfer implications
retention
security measures
rights-handling workflow
DPIA requirement where applicable
school/DPA contractual wording
```

---

# 7. Token and log minimization

The following data must never enter application/audit logs:

```text
Google ID token
Google access/refresh token
authorization code
OAuth client secret
SkillStorm access/refresh session token
password/reset token
```

SSO audit events should contain only operationally necessary coarse metadata such as action type, internal user/organization IDs and timestamps where justified.

### Logging rule

An exception stack or request debug dump must not accidentally serialize the incoming SSO DTO with `idToken`.

This requires regression tests or log-redaction controls, not only a documentation promise.

---

# 8. Identity lifecycle

## Link

An external identity can be linked only after provider identity/e-mail verification under the current policy.

## Use

Successful SSO updates only necessary identity operational metadata.

## Unlink

A future self-service unlink flow must verify that the account will retain at least one safe authentication/recovery path, unless an administrator-managed lifecycle intentionally disables the account.

## Delete / anonymize

Current privacy-service behavior must remove external identity PII when a user is anonymized/deleted according to the active retention/legal policy and invalidate active authentication sessions as required by the account lifecycle.

This behavior must be covered by tests; documentation is not a substitute for verifying actual cascade/anonymization behavior.

---

# 9. Data-subject rights and exports

The platform's privacy/export workflow must account for identity records where they are personal data in scope.

Production readiness requires an explicit decision for:

- access/export representation;
- correction of inaccurate locally stored identity metadata;
- deletion/anonymization behavior;
- identity unlinking;
- audit-log retention/redaction;
- legal retention exceptions where applicable.

A record being technically queryable by `userId` does not by itself mean the end-user rights workflow is complete.

---

# 10. Retention

Retention must be purpose-based and documented.

Current identity records are lifecycle-linked to the user account, but before production use the project must define:

```text
why each identity field is retained
when it is deleted/anonymized
how last-used/security metadata expires or remains justified
how audit events are de-identified/retained
how school offboarding affects identities and memberships
```

Do not keep identity metadata indefinitely merely because storage is cheap.

---

# 11. Security/privacy threat checklist

At minimum review:

| Risk | Required control direction |
| --- | --- |
| forged/replayed provider identity | server-side verified provider protocol + production state/nonce/replay controls |
| wrong audience/issuer | strict verification |
| unverified e-mail linking | reject |
| cross-tenant access | live Membership + server-side tenant scope |
| wrong organization selected | explicit multi-org selection contract |
| mass unknown-account provisioning | auto-provision default off + org policy + rate limit |
| role escalation during provisioning | no automatic Membership/role |
| token leakage | no storage/logging; DTO/log redaction tests |
| disabled/anonymized user login | reject |
| child-data overcollection | data minimization + school/privacy review |
| provider outage | recovery/fallback operational plan |

---

# 12. Production privacy/compliance gate

Google SSO may be enabled for production schools only when all applicable items are closed and evidence exists:

```text
ENGINEERING / SECURITY
[ ] production OIDC/authorization-code architecture implemented
[ ] state/nonce/replay protections tested
[ ] production token verification implemented
[ ] admin SSO configuration API/UI is RBAC-protected and audited
[ ] identity unlink/recovery lifecycle implemented
[ ] provider failure/disable rollback tested
[ ] real end-to-end SSO scenarios green
[ ] token/log redaction tests green

PRIVACY / LEGAL
[ ] exact processing purposes documented
[ ] data inventory verified against schema/API/logs
[ ] lawful basis/legal authority reviewed for target deployment
[ ] controller/processor allocation reviewed
[ ] DPA/privacy notice updated where required
[ ] sub-processor/international-transfer analysis completed where applicable
[ ] retention schedule approved
[ ] data-subject rights workflow covers identity records
[ ] DPIA necessity assessed and DPIA completed if required
[ ] child-specific transparency/account-lifecycle approach approved

SCHOOL OPERATIONS
[ ] domain ownership/policy confirmed
[ ] staff vs pupil provisioning policy explicit
[ ] auto-provision choice explicit
[ ] offboarding/deprovisioning process defined
[ ] emergency admin/recovery path defined without auth bypass
```

Simply setting:

```text
GOOGLE_SSO_ENABLED=true
```

is **not** a production-readiness gate.

---

# 13. Change-control rule

Any future addition of:

- Microsoft/Entra ID;
- Google Classroom/Drive/etc.;
- profile synchronization;
- SCIM provisioning;
- role mapping from external groups;
- parent identity federation;
- pupil self-registration;
- biometric/voice identity;

requires a new explicit privacy/security data-flow review before implementation or production rollout.

---

## Final invariant

> **SkillStorm SSO must collect only the identity data needed for authentication, must never turn provider identity into school authorization, and must not be enabled for children/schools in production until the actual technical, legal and operational processing arrangement has been reviewed and evidenced.**