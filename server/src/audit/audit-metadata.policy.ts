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
  'count',

  // registration audit trail (enum / internal id — no PII)
  'mode',
  'onboardingState',
  'inviteId',

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

  // curriculum provenance — stable identifiers, hashes and enums only.
  // Human-entered curriculum titles, rationales and document names remain
  // intentionally excluded from top-level audit metadata.
  'frameworkCode',
  'releaseCode',
  'sourceChecksum',
  'profileId',
  'academicYearId',
  'grade',
  'classSectionId',
  'schoolCurriculumVersionId',
  'frameworkReleaseId',
  'proposedByType',
  'schoolOutcomeId',
  'frameworkOutcomeId',
  'outcomeAspectId',

  // Activity Engine provenance — IDs, hashes, engine identifiers and enums only.
  'activityId',
  'activityVersionId',
  'mappingId',
  'contentChecksum',
  'engineKey',
  'schemaVersion',
  'scope',

  // Lesson Experience provenance — stable IDs, counts and hashes only.
  // Prompts, learning objectives, teacher guidance and pedagogical rationale
  // remain deliberately absent from audit metadata.
  'lessonExperienceId',
  'lessonExperienceVersionId',
  'lessonExperienceMappingId',
  'stageCount',

  // lightweight support tickets
  'category',
  'page',
  'status',
  'fromStatus',
  'toStatus',
  'priority',
  'assignedToId',
  'assignedToName',
  'resolverId',
  'resolverName',
  'resolutionNote',
  'hasInternalNote',
  'resolvedAt',
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
