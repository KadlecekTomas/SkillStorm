/**
 * Deprecation kill-switch dates. After the given date, CI tests in test/deprecations.spec.ts
 * will fail until the deprecated behaviour is removed.
 *
 * Can be overridden via env for local or one-off runs:
 * - ACTIVE_ALIAS_REMOVAL_DATE=2026-08-20 (default)
 */
export const ACTIVE_ALIAS_REMOVAL_DATE =
  process.env.ACTIVE_ALIAS_REMOVAL_DATE ?? '2026-08-20';

export function isActiveAliasRemovalDue(): boolean {
  return new Date() > new Date(ACTIVE_ALIAS_REMOVAL_DATE);
}
