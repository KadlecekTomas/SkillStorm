"use client";

import { useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/use-auth-store";
import type { OrganizationRole } from "@/types";
import { PermissionKey } from "@/types";

export const usePermissions = () => {
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
