import { OrganizationRole, PermissionKey } from '@prisma/client';

type RoleDefaults = Partial<
  Record<OrganizationRole, PermissionKey[] | typeof ALL_PERMISSIONS>
>;

const ALL_PERMISSIONS = '*';

export const RBAC_DEFAULT_PERMISSIONS: RoleDefaults = {
  OWNER: ALL_PERMISSIONS,
  DIRECTOR: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.DELETE_TEST,
    PermissionKey.VIEW_RESULTS,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  ],
  TEACHER: [
    PermissionKey.CREATE_TEST,
    PermissionKey.EDIT_TEST,
    PermissionKey.VIEW_RESULTS,
  ],
  STUDENT: [PermissionKey.VIEW_RESULTS],
  PARENT: [PermissionKey.VIEW_RESULTS],
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
