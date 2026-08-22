/**
 * Audit metadata allowlist and denylist.
 *
 * ALLOWLIST — only these top-level keys survive in audit log metadata.
 * Nested objects (e.g. `before`, `after`) have their values recursively
 * denylist-filtered but are NOT subject to the allowlist.
 *
 * DENYLIST — credential-shaped keys are stripped at every depth. Keys are
 * normalized (lowercase, punctuation removed) before matching, so variants
 * like `Password`, `reset_token` and `set-cookie` cannot bypass the policy.
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
  'reasonCode',
  'counts',
  'result',
  'count',
  'source',

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

  // platform / authorization operations
  'organizationId',
  'targetUserId',
  'targetEntityId',
  'actorMembershipId',
  'targetMembershipId',
  'role',
  'previousRole',
  'previousPrimaryRole',
  'nextRole',
  'permissionKey',

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

/**
 * Values are normalized forms (lowercase, non-alphanumeric characters removed).
 * Keep this list credential-focused: business identifiers such as tokenVersion
 * are intentionally not blocked by substring matching.
 */
export const AUDIT_METADATA_DENYLIST = new Set<string>([
  'password',
  'pass',
  'temporarypassword',
  'passwordhash',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'resettoken',
  'resettokenhash',
  'invitetoken',
  'sessiontoken',
  'jwt',
  'secret',
  'clientsecret',
  'sessionsecret',
  'apikey',
  'authorization',
  'cookie',
  'setcookie',
  'credential',
  'credentials',
  'privatekey',
]);
