"use client";

import { useMemo } from "react";
import type { OrganizationRole, PermissionKey } from "@/types";
import { useAuth } from "@/lib/guard/useAuth";

export type GuardOptions = {
  requireRoles?: OrganizationRole[];
  requirePerms?: PermissionKey[];
  requireOrganization?: boolean;
  requireSchoolWorkspace?: boolean;
};

export type GuardReason =
  | "UNAUTHENTICATED"
  | "NO_ORGANIZATION"
  | "FORBIDDEN"
  | null;

export type GuardResult = {
  allowed: boolean;
  reason: GuardReason;
  missingRoles: OrganizationRole[];
  missingPermissions: PermissionKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
  authStatus:
    | "anonymous"
    | "authenticating"
    | "authenticated"
    | "refreshing"
    | "unauthenticated";
};

export const useGuard = (options?: GuardOptions): GuardResult => {
  const {
    roles,
    activeRole,
    permissions,
    isAuthenticated,
    isLoading,
    hasOrganization,
    authStatus,
  } = useAuth();

  const { allowed, reason, missingRoles, missingPermissions } = useMemo(() => {
    if (isLoading) {
      return {
        allowed: false,
        reason: null as GuardReason,
        missingRoles: options?.requireRoles ?? [],
        missingPermissions: options?.requirePerms ?? [],
      };
    }
    if (!isAuthenticated) {
      return {
        allowed: false,
        reason: "UNAUTHENTICATED" as GuardReason,
        missingRoles: options?.requireRoles ?? [],
        missingPermissions: options?.requirePerms ?? [],
      };
    }

    const requiredRoles = options?.requireRoles ?? [];
    const requiredPermissions = options?.requirePerms ?? [];
    const requiresOrganization =
      options?.requireOrganization === true ||
      options?.requireSchoolWorkspace === true;

    if (requiresOrganization && !hasOrganization) {
      return {
        allowed: false,
        reason: "NO_ORGANIZATION" as GuardReason,
        missingRoles: requiredRoles,
        missingPermissions: requiredPermissions,
      };
    }

    // Multi-role: route guard rozhoduje AKTIVNÍ role (konzistence se
    // serverem — učitel-rodič musí na rodičovské stránky přepnout kontext).
    // Fallback na roles (union) drží kompatibilitu se starším cache profilem
    // bez activeRole.
    const effectiveRoles = activeRole ? [activeRole] : roles;
    const roleCheck =
      !requiredRoles.length ||
      requiredRoles.some((role) => effectiveRoles.includes(role));
    const missingRoleList = requiredRoles.filter(
      (role) => !effectiveRoles.includes(role),
    );

    const permissionCheck =
      !requiredPermissions.length ||
      requiredPermissions.some((permission) =>
        permissions.includes(permission),
      );
    const missingPermissionList = requiredPermissions.filter(
      (permission) => !permissions.includes(permission),
    );

    if (roleCheck && permissionCheck) {
      return {
        allowed: true,
        reason: null,
        missingRoles: [],
        missingPermissions: [],
      };
    }

    return {
      allowed: false,
      reason: "FORBIDDEN" as GuardReason,
      missingRoles: missingRoleList,
      missingPermissions: missingPermissionList,
    };
  }, [
    isAuthenticated,
    isLoading,
    hasOrganization,
    roles,
    activeRole,
    permissions,
    options?.requireRoles,
    options?.requirePerms,
    options?.requireOrganization,
    options?.requireSchoolWorkspace,
  ]);
  return {
    allowed,
    reason,
    missingRoles,
    missingPermissions,
    isLoading,
    isAuthenticated,
    authStatus,
  };
};
