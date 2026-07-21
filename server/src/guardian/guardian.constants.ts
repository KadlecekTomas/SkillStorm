import { GuardianPermissionKey } from '@prisma/client';

/**
 * Default oprávnění při ověření vztahu (STOP #2, docs/guardian/
 * etapa-b-stop2-navrh.md §2.2). START_TEST default NE — klasifikované testy
 * povoluje škola/učitel explicitně (neporušitelný princip 4).
 */
export const DEFAULT_GUARDIAN_PERMISSIONS: GuardianPermissionKey[] = [
  GuardianPermissionKey.VIEW_RESULTS,
  GuardianPermissionKey.VIEW_ASSIGNMENTS,
  GuardianPermissionKey.START_PRACTICE,
  GuardianPermissionKey.START_HOMEWORK,
  GuardianPermissionKey.RECEIVE_NOTIFICATIONS,
];

/** Párovací kód: jednorázový, expirace 30 dní (STOP #2 doplnění B). */
export const GUARDIAN_INVITE_TTL_DAYS = 30;
export const GUARDIAN_INVITE_MAX_USES = 1;
