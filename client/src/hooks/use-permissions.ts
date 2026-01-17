"use client";

import { useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/use-auth-store";
import type { OrganizationRole, PermissionKey } from "@/types";

export const usePermissions = (): {
  permissions: PermissionKey[];
  can: (permission: PermissionKey) => boolean;
  hasRole: (role: OrganizationRole | "SUPERADMIN") => boolean;
  isSuperAdmin: boolean;
} => {
  const { permissions, user } = useAuthStore((state) => ({
    permissions: state.permissions,
    user: state.user,
  }));

  const can = useCallback(
    (permission: PermissionKey) => permissions.includes(permission),
    [permissions],
  );

  const hasRole = useCallback(
    (role: OrganizationRole | "SUPERADMIN") => {
      if (role === "SUPERADMIN") {
        return user?.systemRole === "SUPERADMIN";
      }
      return user?.organizationRole === role;
    },
    [user],
  );

  return useMemo(
    () => ({
      permissions,
      can,
      hasRole,
      isSuperAdmin: user?.systemRole === "SUPERADMIN",
    }),
    [permissions, can, hasRole, user],
  );
};
