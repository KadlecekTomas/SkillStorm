# Google Workspace onboarding (MVP)

One-way onboarding integration that imports **identity** and **group
membership** from Google Workspace into SkillStorm: users, roles, classes and
enrollments.

## What it does

1. **Connect** an organization's Google Workspace via a read-only OAuth
   authorization-code flow. Tokens are stored **encrypted** (AES-256-GCM).
2. **Read** Google users, groups, group members and org units (Directory API).
3. **Detect** classes from Google Groups and roles from groups / org-units.
4. **Preview** the full import plan (no writes).
5. **Commit** the selected plan in a single Prisma transaction.
6. Record an auditable **SyncRun** + **SyncIssue** trail for every run.

## Tenancy rule (MVP): 1 Organization ↔ 1 Google Workspace tenant

The MVP is strictly one-to-one:

- **1 SkillStorm Organization = 1 Google Workspace tenant** — an organization
  holds at most one `GOOGLE_WORKSPACE` integration (`@@unique([organizationId,
  provider])`).
- **1 Google Workspace tenant = 1 SkillStorm Organization** — the same Google
  `customerId` cannot be connected to two organizations.

Enforced on (re)connect, **before any token is written**:

| Situation | Result |
| --- | --- |
| New tenant, not claimed elsewhere | Connected |
| Same org reconnects the **same** `customerId` | Allowed — tokens refreshed, `organizationId` + `ExternalIdentity` mappings kept, no duplicate row |
| Same org reconnects a **different** `customerId` | `409 GOOGLE_WORKSPACE_TENANT_MISMATCH` — old integration preserved (stays CONNECTED) |
| `customerId` already claimed by **another** org | `409 GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED` |

Backed by a partial unique index
`organization_integrations_provider_customer_unique` on `(provider,
customer_id) WHERE customer_id IS NOT NULL AND deleted_at IS NULL` (NULL
`customer_id` stays unconstrained). The frontend maps both conflict codes to a
single safe message ("Připojený Google Workspace tenant neodpovídá této
organizaci nebo už je připojený k jiné škole."). No tokens are ever leaked in
status or error responses.

**Shared tenant / zřizovatel (district) mode is NOT supported in the MVP** — a
single Google Workspace tenant serving several schools is out of scope. See
*Future: shared tenant mode* below.

### Cross-org data isolation

Every onboarding row is scoped by `organizationId`: `OrganizationIntegration`,
`ExternalIdentity` (`@@unique([organizationId, provider, type, externalId])` —
so the **same Google externalId can exist in two orgs** as two distinct rows),
`ClassSection`, `Enrollment` (via the org-scoped `Student`), `SyncRun` and
`SyncIssue`. A user may legitimately belong to two organizations (one `User`,
two `Membership`s); each org gets its own `Student`/`Teacher` profile and
enrollments. Endpoints additionally reject a `:organizationId` that is not the
caller's active org (403).

### Per-organization sync lock

At most one `RUNNING` `SyncRun` may exist per `(organizationId, provider)` —
enforced by the partial unique index `sync_run_single_running_per_org` plus an
app-level pre-check. A second concurrent commit/resync for the **same** org
fails with `409 GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING`. The lock is **per-org**,
so different schools sync in parallel.

## Why Google Groups are the primary source of classes

Google Groups model the school's real cohorts (`trida-7a@skola.cz`,
`ucitele@skola.cz`, `vedeni@skola.cz`) and are already maintained by school IT.
They give us stable membership lists keyed on **immutable group/user IDs**.
Google Classroom courses are intentionally **out of MVP scope** — they're a
teaching surface, not the authoritative roster, and modelling them as the class
source would couple onboarding to a tool many schools don't use uniformly. The
`GOOGLE_CLASSROOM` provider and `CLASSROOM_COURSE` external-identity type exist
in the schema purely as a future placeholder; there is no functional code.

## Why the sync is one-way (Google → SkillStorm)

- Google Workspace is the source of **identity and group membership**.
- SkillStorm remains the source of truth for **school structure, academic
  years, tests, results and content**.
- We never write back to Google and never request write scopes.
- We **never hard-delete** users, students, classes or results. A student who
  leaves a Google class is marked `LEFT`, not removed.
- Matching is anchored on the **immutable Google user/group ID**
  (`ExternalIdentity.externalId`), never on e-mail — e-mail is not a stable
  identity and may change.

## Scopes (read-only)

```
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.group.readonly
https://www.googleapis.com/auth/admin.directory.group.member.readonly
https://www.googleapis.com/auth/admin.directory.orgunit.readonly
```

No write scopes. No Classroom scopes.

## Environment

```
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GOOGLE_WORKSPACE_REDIRECT_URI=
GOOGLE_INTEGRATION_ENCRYPTION_KEY=   # 32-byte AES key (64 hex chars)
```

The integration is **optional**: when these are unset the application still
boots and the endpoints respond `503` with the machine-readable code
`GOOGLE_WORKSPACE_NOT_CONFIGURED` (the UI shows this as a configuration problem,
not a generic error) instead of crashing.

### Google Cloud Console redirect URI

Register **one** redirect URI (must equal `GOOGLE_WORKSPACE_REDIRECT_URI`):

```
<API origin>/integrations/google-workspace/oauth/callback
# local example: http://localhost:4200/integrations/google-workspace/oauth/callback
```

`organizationId` is **not** in the path — it travels inside the signed `state`,
so a single registered redirect URI serves every organization.

## OAuth redirect flow

1. Admin opens the onboarding page and clicks **Připojit Google Workspace**.
2. Frontend calls `GET …/auth-url` (org-scoped, permission-checked). The backend
   mints a short-lived **HMAC-signed `state`** binding `{organizationId, userId,
   nonce, exp}` and returns the Google consent URL (read-only scopes,
   `response_type=code`, `access_type=offline`, `prompt=consent`).
3. Browser navigates to Google → consent.
4. Google redirects to the fixed callback
   `GET /integrations/google-workspace/oauth/callback?code&state`.
5. The callback (`@Public()`) verifies + **consumes** the one-time `state`
   (signature, expiry, and a server-persisted nonce — see below). Editing
   `organizationId`/`userId` in the URL invalidates the signature, so a foreign
   organization can never be connected. It runs the existing `connect`
   token-exchange (stores **encrypted** tokens) and **302-redirects** to
   `…/google-workspace?connected=1` (or `?error=…`). The code/tokens never
   appear in the final URL.
6. The page reads the query flag, shows a banner, strips the query
   (`history.replaceState`) and refreshes status → **Připojeno**.

The signed `state` is the security boundary: it is minted only inside the
org-scoped, permission-checked `auth-url` endpoint.

### One-time state (replay protection)

The `state` is **single-use**. At `auth-url` a random `nonce` is persisted
(`GoogleOAuthNonce`, with `expiresAt`); the callback verifies the HMAC
signature, the expiry, and then **atomically consumes** the nonce
(`updateMany usedAt: null → now`). Replaying a captured `state`+`code` pair, an
expired link, or a forged signature each fails with a safe redirect:

| Reason | Redirect param | Code |
| --- | --- | --- |
| Bad signature / unknown nonce | `?error=invalid_state` | `GOOGLE_WORKSPACE_INVALID_STATE` |
| Expired link | `?error=expired_state` | `GOOGLE_WORKSPACE_EXPIRED_STATE` |
| Already used (replay) | `?error=replayed_state` | `GOOGLE_WORKSPACE_STATE_REPLAYED` |

### Token refresh & reauth

The directory client refreshes the access token proactively (≈60 s before
`tokenExpiresAt`) using the encrypted refresh token, re-encrypts and stores the
new access token + `tokenExpiresAt`, and clears any prior error. If the refresh
fails (e.g. `invalid_grant` — consent revoked / refresh token expired) the
integration is set to `status = ERROR`; `status` then reports
`needsReconnect: true` and `preview`/`commit` fail with
`409 GOOGLE_WORKSPACE_REAUTH_REQUIRED` (codes:
`GOOGLE_WORKSPACE_TOKEN_REFRESH_FAILED`, `GOOGLE_WORKSPACE_REAUTH_REQUIRED`).
The UI then shows a **"Znovu připojit Google Workspace"** CTA. Tokens are never
logged or returned.

## Dev / mock mode

For UI testing without a real Google tenant set `GOOGLE_WORKSPACE_MOCK_MODE=true`
(honoured only when `NODE_ENV !== production` — it is hard-disabled in
production, so it can never be a prod bypass). Then:

- `auth-url` returns a dev URL `…/dev/google-workspace/mock-connect?state=…`
  instead of the Google consent URL;
- `mock-connect` verifies the same signed `state` and persists a `CONNECTED`
  `OrganizationIntegration` with placeholder token material, then redirects back
  with `connected=1`;
- `preview`/`commit` run against the in-memory fixture
  `MockGoogleWorkspaceDirectoryClient` (no network, no real tokens).

No real OAuth env is required in mock mode.

## API

All endpoints are tenant-scoped under the caller's active organization and
require OWNER/DIRECTOR **or** `MANAGE_STUDENTS` / `MANAGE_TEACHERS`. The
`:organizationId` path param must equal the caller's active org — cross-tenant
sync is rejected.

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `…/google-workspace/auth-url` | Build the Google consent URL (or dev mock URL); 503 `GOOGLE_WORKSPACE_NOT_CONFIGURED` if env missing |
| GET  | `/integrations/google-workspace/oauth/callback` | Public OAuth redirect target; verifies `state`, connects, 302 → frontend |
| POST | `/organizations/:organizationId/integrations/google-workspace/connect` | Exchange OAuth code, store encrypted tokens |
| GET  | `…/google-workspace/status` | Connection status (never returns tokens) |
| POST | `…/google-workspace/preview` | Dry-run import plan (no writes) |
| POST | `…/google-workspace/commit` | Apply selected plan in a transaction |
| POST | `…/google-workspace/resync` | Manual re-run with auto-mappings |
| GET  | `…/google-workspace/sync-runs` | Recent runs |
| GET  | `…/google-workspace/sync-runs/:syncRunId` | One run + its issues |

## Preview / commit

- **Preview** is pure and deterministic (sorted by e-mail / label) and writes
  nothing. It returns `summary`, `classMappings`, `roleMappings`,
  `usersToCreate/Update`, `membershipsToCreate`, `classSectionsToCreate`,
  `enrollmentsToCreate/Deactivate`, `unresolvedGroups`, `warnings`, `errors`.
- **Commit** is **idempotent** and transactional:
  1. resolve each Google user by `ExternalIdentity(externalId)`, then by e-mail,
     then create only if `createMissingUsers`;
  2. upsert the `Membership` and the `Student`/`Teacher` profile;
  3. find-or-create the `ClassSection` (`CREATE`) or use `existingClassSectionId`
     (`MAP_EXISTING`);
  4. upsert the `Enrollment` (`@@unique([studentId, yearId])`);
  5. persist `ExternalIdentity` rows for users and groups.

  New Google users get a **random unusable password hash** (SSO-managed login).

### Class detection

Group e-mail local-part and name are matched against these defaults (Czech
diacritics stripped, separators tolerated):

```
^trida[-_. ]?([1-9])([a-z])$
^([1-9])\.?([a-z])$
^([1-9])[-_. ]?([a-z])$
^zaci[-_. ]?([1-9])([a-z])$
```

`trida-7a@skola.cz` / `7.a@skola.cz` / `zaci-8b@skola.cz` → `GRADE_7`/`8`,
section `A`/`B`, label `7.A` / `8.B`. Confidence `< 0.8` ⇒ the group goes to
`unresolvedGroups` (never an error).

### Role detection

- groups `ucitele` / `teachers` → `TEACHER`
- groups `vedeni` / `management` / `reditel` → `DIRECTOR`
- class groups → `STUDENT`
- org-unit `/Učitelé`, `/Zaměstnanci/Učitelé` → `TEACHER`
- org-unit `/Žáci`, `/Studenti` → `STUDENT`

## Handling conflicts

- **Role conflict** (a user gets several roles): resolved
  `DIRECTOR > TEACHER > STUDENT`, with a `ROLE_CONFLICT` **WARNING** issue.
- **Manual overrides**: an `ExternalIdentity` with `syncMode = MANUAL_OVERRIDE`
  or `IGNORED` is never repointed by a sync (`CLASS_MAPPING_LOCKED` /
  `STUDENT_MOVED_CLASS` warnings instead of silent overwrites).
- **Student moved class**: enrollment `classSectionId` is updated with a
  `STUDENT_MOVED_CLASS` issue, unless a manual override protects it.
- **Student left**: with `deactivateMissingEnrollments`, a Google-sourced
  student no longer in any Google class is set to `EnrollmentStatus.LEFT`
  (`STUDENT_LEFT_GROUP`). Enrollments are never deleted, and manually-created
  enrollments (no Google `ExternalIdentity`) are never touched.

A `SyncRun` ends `DONE` (clean), `PARTIAL` (warnings/recoverable), or `FAILED`
(exception). `OrganizationIntegration.lastSyncAt` is updated only on
`DONE`/`PARTIAL`.

## Audit

Each action logs through the existing `AuditService`:
`GOOGLE_WORKSPACE_CONNECTED`, `_PREVIEWED`, `_IMPORT_COMMITTED`, `_RESYNCED`,
`_SYNC_FAILED`. Tokens, refresh tokens and authorization codes are never logged
or returned.

## Pilot smoke test

Checklist for the first run against a **real** Google Workspace tenant.

Prerequisites (Google Cloud Console):

- [ ] **Admin SDK API** (Directory) enabled for the project.
- [ ] **OAuth consent screen** configured (internal; the connecting user is a
      Workspace admin / has Directory read access).
- [ ] **Authorized redirect URI** = `GOOGLE_WORKSPACE_REDIRECT_URI` =
      `<API origin>/integrations/google-workspace/oauth/callback`.
- [ ] Only the four read-only Directory scopes requested (no write, no
      Classroom).

Environment:

- [ ] `GOOGLE_WORKSPACE_CLIENT_ID` / `_CLIENT_SECRET` / `_REDIRECT_URI` set.
- [ ] `GOOGLE_INTEGRATION_ENCRYPTION_KEY` set (32-byte AES key).
- [ ] `GOOGLE_WORKSPACE_MOCK_MODE` unset / `false`.

Flow:

- [ ] Click **Připojit Google Workspace** → real Google consent → return to the
      app with **Připojeno**.
- [ ] Status shows the correct **domain / customerId**.
- [ ] **Náhled** loads users and groups.
- [ ] Unresolved groups appear in their own section and **do not block** preview.
- [ ] Suspended Google users are **not** silently active students — they carry a
      `USER_SUSPENDED` warning.
- [ ] Nested groups are surfaced as warnings / ignored (not expanded).
- [ ] **Potvrdit import** creates `ClassSection` / `Student` / `Teacher` /
      `Enrollment` for the detected classes.
- [ ] A **re-run** (preview + commit, or resync) is idempotent — no duplicates.
- [ ] The **sync run** is retrievable (`GET …/sync-runs`, `…/sync-runs/:id`).
- [ ] Inspect `GET …/status` and any error response: **no tokens** (access,
      refresh, authorization code) are present.
- [ ] (Optional) Revoke consent in Google, then run preview → integration flips
      to **needs reconnect**, UI shows the **"Znovu připojit"** CTA.

## Manual test scenario

Mock mode (no Google tenant needed): set `GOOGLE_WORKSPACE_MOCK_MODE=true`,
`NODE_ENV=development`, start backend + frontend, log in as a director/owner.

1. Open **Nastavení → Google Workspace** (`/app/settings/integrations/google-workspace`).
2. Click **Připojit Google Workspace** → (mock) redirect → return with the green
   "úspěšně připojen" banner; status shows **Připojeno** (mock režim).
3. Pick the academic year and click **Načíst náhled** → summary cards show 4
   users / 4 groups / 1 class / 2 students / 1 teacher / 1 director, the class
   table shows `trida-7a` → 7.A, and `lyzak-2026` appears under unresolved.
4. Click **Potvrdit import** → success banner with the sync run id.
5. Verify in the app: class **7.A** exists, Alice/Bob are enrolled students,
   the teacher and director have memberships, and a sync run is recorded
   (`GET …/sync-runs`).
6. Re-run preview + commit → idempotent (no new users / enrollments).

Real OAuth: with `GOOGLE_WORKSPACE_*` env set and the redirect URI registered in
Google Cloud Console, step 2 redirects to the real Google consent screen instead.

## Not in MVP

- Google Classroom import (placeholder types only).
- Any write-back to Google Workspace.
- Automatic deletion of users / students / classes / results.
- A scheduled/nightly cron sync — resync is **manual** (`POST …/resync`).
- **Shared tenant / zřizovatel (district) mode** — one Google Workspace tenant
  serving multiple SkillStorm organizations.

## Future: shared tenant mode

To support a district (zřizovatel) whose single Google Workspace tenant hosts
several schools, the 1↔1 `customerId` uniqueness would be relaxed to a
**scoped** model: each organization claims a subset of the tenant via an
**org-unit path or group-name prefix** (e.g. `/Skola-A/*` → org A,
`trida-a-*@` → org A). The tenant-uniqueness guard would then key on
`(customerId, scope)` instead of `customerId` alone, and preview/commit would
filter the directory snapshot to the org's scope. This requires a
`sharedTenantMode` flag + per-org scope config and is deliberately deferred.
