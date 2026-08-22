# SkillStorm audit trail contract

AuditLog is security evidence, not a debug/request dump. Its purpose is to answer who changed what, in which tenant, on which target, and when, without copying credentials or unnecessary personal data.

## Canonical event

Critical events should use a stable action code and populate the existing AuditLog fields where applicable:

- `userId`: actor user
- `organizationId`: target tenant context (for cross-org SUPERADMIN actions this is the target organization)
- `systemRole`: actor platform role when relevant
- `entityType` / `entityId`: affected resource
- `ipAddress` / `userAgent`: request context when available
- `metadata`: small allowlisted forensic context (IDs, enum values, counts, hashes)
- `changedFields`: field names only, never changed values

Do not create parallel audit stores for application mutations.

## Secrets and data minimization

Audit metadata must never persist credentials, including passwords, temporary passwords, password hashes, access/refresh/reset/invite/session tokens, JWTs, authorization headers, cookies, API keys, client/session secrets or private keys. The policy is recursive and key-normalized, so casing and punctuation variants do not bypass it.

Do not store full DTOs, request bodies, student answers, names or e-mail values as change snapshots. Request `body` metadata is reduced to a key/count/nesting summary. `changedFields` is normalized to a list of non-secret field names.

All AuditLog `create`/`createMany` writes pass through the PrismaService boundary sanitizer. This is a safety net for legacy direct `tx.auditLog.create()` call sites; new code should prefer `AuditService.log()`.

## Atomicity and failure mode

Security-critical mutations should write audit evidence inside the same Prisma transaction:

```ts
await prisma.$transaction(async (tx) => {
  await mutate(tx);
  await auditService.log(event, tx);
});
```

`AuditService.log()` is fail-closed: audit persistence errors propagate. It must never catch a database error and silently report mutation success, and it must never log the unsanitized event on an error path.

Where a generic HTTP interceptor is the only available audit boundary, the response must not complete successfully until the audit write succeeds. Prefer service-level transaction atomicity whenever the business operation exposes a transaction client.

## Immutability

AuditLog is append-only. Ordinary `update`, `upsert`, `delete` and `deleteMany` are prohibited by Prisma middleware. `updateMany` is reserved exclusively for the GDPR retention anonymization context and may only null `userId`, `ipAddress` and `userAgent`.

Test cleanup must not weaken or bypass this invariant in application code.

## Tenant read scope

- `DIRECTOR` / `OWNER`: own organization only, with IP/user-agent redacted.
- `STUDENT`, `TEACHER`, `PARENT`: no organization audit-log access unless a future explicit permission contract is designed and reviewed.
- `SUPERADMIN`: platform-wide full audit view.
- `DEVOPS` / `SUPPORT`: platform-wide restricted view with IP/user-agent redacted.

Organization audit endpoints must derive organization scope from authenticated context, never from a client-supplied organization ID.

## Adding a critical audit event

1. Reuse the canonical `AuditService`; do not write free-form log strings as the primary evidence.
2. Use a stable action code (`USER_PERMISSION_GRANT`, `MEMBERSHIP_ROLE_REVOKE`, etc.).
3. Put only stable IDs/enums/counts in metadata and add new top-level metadata keys to the explicit allowlist only when they have a forensic purpose.
4. Put the audit write in the same transaction as the critical mutation when possible.
5. Add a test that proves actor, tenant, target and safe metadata, plus a negative assertion that credentials are absent.
6. Preserve tenant isolation, AuditLog immutability and the existing GDPR retention path.
