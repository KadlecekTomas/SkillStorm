"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";

export const useRoleView = (): string => {
  const { user, hasOrganization, context } = useAuth();
  return useMemo(
    () => {
      if (context?.mode === "platform") return "platform";
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
