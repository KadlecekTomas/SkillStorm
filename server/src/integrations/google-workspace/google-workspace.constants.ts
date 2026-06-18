/**
 * Google Workspace onboarding — shared constants.
 *
 * Read-only Directory API scopes only. No write scopes, no Classroom scopes
 * in the MVP (see docs/google-workspace-onboarding.md).
 */
export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
] as const;

/**
 * Default class-group detection patterns. Applied to both the group e-mail
 * local-part (before `@`) and the group display name, after lowercasing and
 * Czech-diacritics stripping. Capture group 1 = grade digit, group 2 = section.
 */
export const DEFAULT_CLASS_GROUP_PATTERNS = [
  '^trida[-_. ]?([1-9])([a-z])$',
  '^([1-9])\\.?([a-z])$',
  '^([1-9])[-_. ]?([a-z])$',
  '^zaci[-_. ]?([1-9])([a-z])$',
] as const;

/** Group name/email substrings that map a whole group to the TEACHER role. */
export const DEFAULT_TEACHER_GROUP_PATTERNS = ['ucitele', 'teachers'] as const;

/** Group name/email substrings that map a whole group to the DIRECTOR role. */
export const DEFAULT_DIRECTOR_GROUP_PATTERNS = [
  'vedeni',
  'management',
  'reditel',
] as const;

/** Org-unit path fragments → role. Matched case-insensitively, diacritics stripped. */
export const ORG_UNIT_TEACHER_FRAGMENTS = [
  '/ucitele',
  '/zamestnanci/ucitele',
] as const;
export const ORG_UNIT_STUDENT_FRAGMENTS = ['/zaci', '/studenti'] as const;

/** Confidence below which a detected class group is treated as unresolved. */
export const CLASS_CONFIDENCE_THRESHOLD = 0.8;

/** Injection token for the directory client (swapped for a mock in tests). */
export const GOOGLE_WORKSPACE_DIRECTORY_CLIENT = Symbol(
  'GOOGLE_WORKSPACE_DIRECTORY_CLIENT',
);

/** Machine-readable code returned when OAuth env is missing (503). */
export const GOOGLE_WORKSPACE_NOT_CONFIGURED =
  'GOOGLE_WORKSPACE_NOT_CONFIGURED';

/** This Google tenant (customerId) is already connected to another org (409). */
export const GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED =
  'GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED';

/** This org is already bound to a different Google tenant on reconnect (409). */
export const GOOGLE_WORKSPACE_TENANT_MISMATCH =
  'GOOGLE_WORKSPACE_TENANT_MISMATCH';

/** A commit/resync is already RUNNING for this org+provider (409). */
export const GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING =
  'GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING';

/** OAuth `state` signature/payload invalid. */
export const GOOGLE_WORKSPACE_INVALID_STATE = 'GOOGLE_WORKSPACE_INVALID_STATE';

/** OAuth `state` nonce expired. */
export const GOOGLE_WORKSPACE_EXPIRED_STATE = 'GOOGLE_WORKSPACE_EXPIRED_STATE';

/** OAuth `state` nonce already consumed (replay attempt). */
export const GOOGLE_WORKSPACE_STATE_REPLAYED =
  'GOOGLE_WORKSPACE_STATE_REPLAYED';

/** Access-token refresh against Google failed. */
export const GOOGLE_WORKSPACE_TOKEN_REFRESH_FAILED =
  'GOOGLE_WORKSPACE_TOKEN_REFRESH_FAILED';

/** Integration needs a fresh OAuth consent (refresh token invalid/revoked). */
export const GOOGLE_WORKSPACE_REAUTH_REQUIRED =
  'GOOGLE_WORKSPACE_REAUTH_REQUIRED';

/** Frontend onboarding route the OAuth callback redirects back to. */
export const ONBOARDING_FRONTEND_PATH =
  '/app/settings/integrations/google-workspace';

/** Lifetime of a signed OAuth `state` token. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
