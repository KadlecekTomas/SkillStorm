"use client";

import type { ComponentType } from "react";
import { useEffect } from "react";
import type { PermissionKey } from "@/types";
import { PermissionGate } from "@/components/access/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/use-auth-store";
import { getRoleHomePath } from "@/utils/permissions";
import { useRouter } from "next/navigation";

export const withPermission = <P extends object>(
  permission: PermissionKey | PermissionKey[],
) => {
  return function withPermissionWrapper(Component: ComponentType<P>) {
    const GuardedComponent = (props: P) => {
      const { can } = usePermissions();
      const user = useAuthStore((state) => state.user);
      const router = useRouter();
      const permissions = Array.isArray(permission)
        ? permission
        : [permission];
      const allowed = permissions.some((perm) => can(perm));

      useEffect(() => {
        if (!allowed) {
          const destination = getRoleHomePath(user);
          router.replace(destination);
        }
      }, [allowed, router, user]);

      return (
        <PermissionGate permission={permission}>
          <Component {...props} />
        </PermissionGate>
      );
    };

    GuardedComponent.displayName = `WithPermission(${Component.displayName ?? Component.name ?? "Component"})`;
    return GuardedComponent;
  };
};
