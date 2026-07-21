import type { OrganizationRole } from '@prisma/client';
import { PermissionKey } from '@prisma/client';

type RoleDefaults = Partial<
  Record<OrganizationRole, PermissionKey[] | typeof ALL_PERMISSIONS>
>;

const ALL_PERMISSIONS = '*';

/** Business rule: DIRECTOR must have at least the same permissions as TEACHER in their organization. */
const TEACHER_PERMISSIONS: PermissionKey[] = [
  PermissionKey.CREATE_TEST,
  PermissionKey.EDIT_TEST,
  PermissionKey.VIEW_RESULTS,
  PermissionKey.VIEW_ANALYTICS,
  PermissionKey.INVITE_STUDENTS,
  PermissionKey.VIEW_TEST_OVERVIEW,
  PermissionKey.MANAGE_TESTS,
  PermissionKey.ASSIGN_TESTS,
  PermissionKey.VIEW_SUBMISSIONS,
  PermissionKey.VIEW_CLASS_ASSIGNMENTS,
  PermissionKey.VIEW_OWN_ASSIGNMENTS,
];

const DIRECTOR_EXTRA: PermissionKey[] = [
  PermissionKey.DELETE_TEST,
  PermissionKey.MANAGE_STUDENTS,
  PermissionKey.MANAGE_TEACHERS,
  PermissionKey.INVITE_TEACHERS,
  PermissionKey.MANAGE_ASSIGNMENTS,
  PermissionKey.VIEW_ORG_ASSIGNMENTS,
];

export const RBAC_DEFAULT_PERMISSIONS: RoleDefaults = {
  OWNER: ALL_PERMISSIONS,
  DIRECTOR: [...TEACHER_PERMISSIONS, ...DIRECTOR_EXTRA],
  TEACHER: TEACHER_PERMISSIONS,
  STUDENT: [
    PermissionKey.VIEW_RESULTS,
    PermissionKey.VIEW_TEST_OVERVIEW,
    PermissionKey.VIEW_SUBMISSIONS,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
  ],
  // Guardian audit (docs/guardian.md §1): rodič NEMÁ žádné školní klíče.
  // Rodinný prostor jede výhradně přes /guardian/* se vztahovou autorizací
  // per dítě; školní pohledy jsou pro PARENT vždy 403.
  PARENT: [],
};

export function isPermissionAllowedByDefault(
  role: OrganizationRole,
  key: PermissionKey,
): boolean {
  const config = RBAC_DEFAULT_PERMISSIONS[role];
  if (!config) {
    return false;
  }
  if (config === ALL_PERMISSIONS) {
    return true;
  }
  return config.includes(key);
}
