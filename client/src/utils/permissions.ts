import type { User } from "@/types";
import type { PermissionKey } from "@/types";
import { roleHome } from "@/types/permissions";

/** Single source of truth: user may access /app/platform* (SUPERADMIN or platform admin flag). */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.systemRole === "SUPERADMIN" || user.isPlatformAdmin === true;
}

/** Platform read access — SUPERADMIN | SUPPORT | DEVOPS | delegated platform admin. */
export function canAccessPlatform(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.systemRole === "SUPERADMIN" ||
    user.systemRole === "SUPPORT" ||
    user.systemRole === "DEVOPS" ||
    user.isPlatformAdmin === true
  );
}

/** Platform mutations remain restricted to SUPERADMIN. */
export function canMutatePlatform(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.systemRole === "SUPERADMIN";
}

export function canTriageSupport(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.systemRole === "SUPERADMIN" || user.systemRole === "SUPPORT";
}

/**
 * Runtime permissions are server-authoritative.
 *
 * `/auth/me`, login and role/org switching all return the effective permission
 * set after role defaults, organization overrides and user overrides have been
 * resolved. Guessing permissions from a static role matrix on the client can
 * expose actions that the API will reject (or, worse, hide actions that are
 * explicitly granted). If a legacy/stale profile does not contain permissions,
 * fail closed until the auth bootstrap refreshes it from the server.
 */
export const derivePermissions = (user: User | null): PermissionKey[] => {
  if (!user) return [];
  if (!Array.isArray(user.permissions)) return [];
  return Array.from(new Set<PermissionKey>(user.permissions));
};

/** Fallback when role home is unknown or route missing. Must exist. */
export const DASHBOARD_ENTRY = "/app";

const PLATFORM_HOME = "/app/platform";

export const getRoleHomePath = (user: User | null): string => {
  if (!user) return roleHome.DEFAULT;
  if (
    user.systemRole === "SUPERADMIN" ||
    user.systemRole === "SUPPORT" ||
    user.systemRole === "DEVOPS"
  ) {
    return PLATFORM_HOME;
  }
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
