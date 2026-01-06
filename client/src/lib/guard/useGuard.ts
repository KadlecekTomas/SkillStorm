"use client";

import { useMemo } from "react";
import type { OrganizationRole, PermissionKey } from "@/types";
import { useAuth } from "@/lib/guard/useAuth";

export type GuardOptions = {
  requireRoles?: OrganizationRole[];
  requirePerms?: PermissionKey[];
};

export type GuardReason = "UNAUTHENTICATED" | "NO_ORGANIZATION" | "FORBIDDEN" | null;

export type GuardResult = {
  allowed: boolean;
  reason: GuardReason;
  missingRoles: OrganizationRole[];
  missingPermissions: PermissionKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
};

export const useGuard = (options?: GuardOptions): GuardResult => {
  const { roles, permissions, isAuthenticated, isLoading, org } = useAuth();

  const { allowed, reason, missingRoles, missingPermissions } = useMemo(() => {
    if (!isAuthenticated) {
      return {
        allowed: false,
        reason: "UNAUTHENTICATED" as GuardReason,
        missingRoles: options?.requireRoles ?? [],
        missingPermissions: options?.requirePerms ?? [],
      };
    }

    if (!org) {
      return {
        allowed: false,
        reason: "NO_ORGANIZATION" as GuardReason,
        missingRoles: options?.requireRoles ?? [],
        missingPermissions: options?.requirePerms ?? [],
      };
    }

    const requiredRoles = options?.requireRoles ?? [];
    const requiredPermissions = options?.requirePerms ?? [];

    const roleCheck =
      !requiredRoles.length ||
      requiredRoles.some((role) => roles.includes(role));
    const missingRoleList = requiredRoles.filter(
      (role) => !roles.includes(role),
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
  }, [isAuthenticated, org, roles, permissions, options]);

  return {
    allowed,
    reason,
    missingRoles,
    missingPermissions,
    isLoading,
    isAuthenticated,
  };
};
