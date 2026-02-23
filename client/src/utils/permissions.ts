import type { User } from "@/types";
import type { PermissionKey } from "@/types";
import {
  ROLE_PERMISSION_MATRIX,
  SYSTEM_ROLE_PERMISSIONS,
  roleHome,
} from "@/types/permissions";

/** Single source of truth: user may access /app/platform* (SUPERADMIN or platform admin flag). */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.systemRole === "SUPERADMIN" || user.isPlatformAdmin === true;
}

export const derivePermissions = (user: User | null): PermissionKey[] => {
  if (!user) return [];

  if (Array.isArray(user.permissions)) {
    return Array.from(new Set<PermissionKey>(user.permissions));
  }

  const system = user.systemRole
    ? SYSTEM_ROLE_PERMISSIONS[user.systemRole] ?? []
    : [];
  const org = user.organizationRole
    ? ROLE_PERMISSION_MATRIX[user.organizationRole] ?? []
    : [];
  const unique = new Set<PermissionKey>([
    ...system,
    ...org,
  ]);
  return Array.from(unique);
};

/** Fallback when role home is unknown or route missing. Must exist (app/(app)/app/page.tsx). */
export const DASHBOARD_ENTRY = "/app";

const PLATFORM_HOME = "/app/platform";

export const getRoleHomePath = (user: User | null): string => {
  if (!user) return roleHome.DEFAULT;
  if (user.systemRole === "SUPERADMIN") return PLATFORM_HOME;
  const activeMembership =
    user.memberships?.find(
      (membership) => membership.organizationId === user.organizationId,
    ) ?? user.memberships?.[0];
  if (!activeMembership?.organizationId) {
    return roleHome.DEFAULT;
  }
  if (user.organizationRole && roleHome[user.organizationRole]) {
    return roleHome[user.organizationRole];
  }
  return roleHome.DEFAULT;
};
