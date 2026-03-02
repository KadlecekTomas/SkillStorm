/**
 * Audit metadata allowlist and denylist.
 *
 * ALLOWLIST — only these top-level keys survive in audit log metadata.
 * Nested objects (e.g. `before`, `after`) have their values recursively
 * denylist-filtered but are NOT subject to the allowlist.
 *
 * DENYLIST — these keys are stripped at every depth, case-insensitively.
 * Matching is always case-insensitive to catch variants like Password, PASSWORD.
 */

export const AUDIT_METADATA_ALLOWLIST = new Set<string>([
  // request / correlation
  'requestId',
  'traceId',

  // change summary
  'changedFields',
  'before',
  'after',

  // operational
  'reason',
  'counts',
  'result',

  // HTTP request context (PlatformMutationAuditInterceptor)
  // Note: 'body' is intentionally excluded — real values are PII risk.
  // The sanitizer transforms body → { bodyKeys, bodySize, bodyHasNested }.
  'params',
  'bodyKeys',
  'bodySize',
  'bodyHasNested',

  // platform ops
  'organizationId',
  'targetUserId',
  'targetEntityId',
]);

export const AUDIT_METADATA_DENYLIST = new Set<string>([
  'password',
  'pass',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
]);
