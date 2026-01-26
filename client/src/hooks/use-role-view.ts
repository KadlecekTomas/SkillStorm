"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";

export const useRoleView = (): string => {
  const { user, hasOrganization } = useAuth();
  return useMemo(
    () => {
      if (!hasOrganization) return "personal";
      return (
        user?.organizationRole?.toLowerCase() ??
        user?.systemRole?.toLowerCase() ??
        "guest"
      );
    },
    [user, hasOrganization],
  );
};
