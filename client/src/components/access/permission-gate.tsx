"use client";

import type { ReactNode } from "react";
import type { PermissionKey } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import { RestrictedView } from "@/components/access/restricted-view";

type PermissionGateProps = {
  permission?: PermissionKey | PermissionKey[];
  fallback?: ReactNode;
  children: ReactNode;
};

export const PermissionGate = ({
  permission,
  fallback,
  children,
}: PermissionGateProps): React.JSX.Element => {
  const { can } = usePermissions();

  if (!permission) {
    return <>{children}</>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = permissions.some((perm) => can(perm));

  if (!allowed) {
    // Explicitní fallback (včetně null = „nic nevykresluj") má přednost;
    // RestrictedView je jen default, když volající fallback vůbec neuvedl.
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return (
      <RestrictedView description="Tento modul je dostupný jen pro role s vyšším oprávněním." />
    );
  }

  return <>{children}</>;
};
