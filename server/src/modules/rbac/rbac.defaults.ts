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
  // PARENT invariant (INV4): rodič nezískává ŽÁDNÉ generické oprávnění přes
  // roli. Rodičovský přístup se vyhodnocuje výhradně vztahovou cestou vůči
  // konkrétnímu dítěti (GuardianStudentRelation / GuardianPermissionKey), viz
  // guardian-spec.md §9 a docs/guardian.md. Prázdný default zajišťuje, že ani
  // boot-sync ani seed nevytvoří generické PARENT role_permissions.
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
