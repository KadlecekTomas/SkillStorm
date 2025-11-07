"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/use-auth-store";

export const useRoleView = () => {
  const user = useAuthStore((state) => state.user);
  return useMemo(
    () => user?.organizationRole?.toLowerCase() ?? "teacher",
    [user],
  );
};
