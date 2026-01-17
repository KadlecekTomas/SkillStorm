import type { User } from "@/types";
import type { PermissionKey } from "@/types";
import {
  ROLE_PERMISSION_MATRIX,
  SYSTEM_ROLE_PERMISSIONS,
  roleHome,
} from "@/types/permissions";

export const derivePermissions = (user: User | null): PermissionKey[] => {
  if (!user) return [];

  const system = user.systemRole
    ? SYSTEM_ROLE_PERMISSIONS[user.systemRole] ?? []
    : [];
  const org = user.organizationRole
    ? ROLE_PERMISSION_MATRIX[user.organizationRole] ?? []
    : [];
  const provided = user.permissions ?? [];
  const unique = new Set<PermissionKey>([
    ...provided,
    ...system,
    ...org,
  ]);
  return Array.from(unique);
};

export const getRoleHomePath = (user: User | null): string => {
  if (!user) return roleHome.DEFAULT;
  if (user.organizationRole && roleHome[user.organizationRole]) {
    return roleHome[user.organizationRole];
  }
  return roleHome.DEFAULT;
};
