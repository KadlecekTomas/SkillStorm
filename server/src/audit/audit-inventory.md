# SS-P1-02 critical audit inventory

This inventory records the production-facing audit classification used by the SS-P1-02 hardening pass. It is intentionally scoped to security/provisioning/governance mutations rather than treating every CRUD action as critical.

| Domain | Operation | Before | Classification | SS-P1-02 treatment |
|---|---|---|---|---|
| Auth | Imported-user password change | Same transaction with direct AuditLog create | ALREADY_SUFFICIENT | Preserve; Prisma boundary sanitizer protects direct write |
| Auth | Token-based password reset completion | Business transaction followed by awaited audit | CRITICAL_AUDIT_REQUIRED | Audit is now fail-closed; same-transaction conversion remains a follow-up if AuthService transaction API is refactored |
| Auth | Password-reset request | Token create followed by awaited audit | AUDIT_RECOMMENDED | Fail-closed audit; no token value is recorded |
| Import | Student row import | User/membership/student/enrollment + audit in one transaction | ALREADY_SUFFICIENT | Preserve; direct audit write centrally sanitized |
| People | Admin student profile/class move | Mutation + audit in one transaction | ALREADY_SUFFICIENT | `changedFields` now stores field names only, not PII values |
| Membership | Assign secondary role | Audit occurred after transaction | CRITICAL_AUDIT_REQUIRED | Audit moved into same transaction |
| Membership | Revoke secondary role | Audit occurred after transaction | CRITICAL_AUDIT_REQUIRED | Audit moved into same transaction |
| Membership | Change primary role | Audit occurred after transaction | CRITICAL_AUDIT_REQUIRED | Audit moved into same transaction |
| RBAC | Grant/revoke RolePermission | Mutation then separate direct AuditLog create | CRITICAL_AUDIT_REQUIRED | Mutation + canonical audit now one transaction |
| RBAC | Grant/revoke UserPermission | Mutation then separate direct AuditLog create | CRITICAL_AUDIT_REQUIRED | Mutation + canonical audit now one transaction; PARENT guard unchanged |
| Platform | SUPERADMIN mutation endpoints | Fire-and-forget interceptor swallowed audit errors | CRITICAL_AUDIT_REQUIRED | Interceptor now awaits audit and fails response closed |
| Content/catalog | Existing audited create/update/publish paths | Mixed direct/canonical AuditLog writes | AUDIT_RECOMMENDED / ALREADY_SUFFICIENT | Global Prisma AuditLog boundary sanitizer prevents credential/changed-value leakage |
| Assessment | Existing test/submission mutations with audit | Mixed direct/canonical AuditLog writes | AUDIT_RECOMMENDED / ALREADY_SUFFICIENT | Global Prisma AuditLog boundary sanitizer applies; authorization behavior unchanged |
| Audit | AuditLog update/upsert/delete | Update/delete blocked; upsert was not explicitly blocked | CRITICAL_AUDIT_REQUIRED | Append-only middleware now blocks upsert too |
| Audit reads | Organization audit logs | DIRECTOR/OWNER hard-scoped to JWT organization | ALREADY_SUFFICIENT | Preserved unchanged |
| Audit reads | Platform audit logs | Platform roles with field-level redaction | ALREADY_SUFFICIENT | Preserved unchanged |

## Residual design note

`AuthService.resetPasswordWithToken()` uses an array transaction for the password/token changes and then performs an awaited canonical audit. Because `AuditService` is now fail-closed, the caller cannot receive success if audit persistence fails, but the already-committed password reset cannot be rolled back by that later audit failure. Converting this one path to an interactive transaction is desirable, but rewriting the large authentication transaction surface solely for SS-P1-02 is intentionally not mixed into the first hardening patch unless acceptance testing demonstrates that strict rollback atomicity is required for this path.
