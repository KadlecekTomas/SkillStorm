"use client";

import { useCallback } from "react";
import { apiClient } from "@/utils/api-client";

export const useAnalytics = () => {
  const logEvent = useCallback(
    async (
      category: string,
      action: string,
      metadata?: Record<string, unknown>,
    ) => {
      try {
        await apiClient.post("/analytics/log", {
          category,
          action,
          metadata: metadata ?? null,
        });
      } catch {
        // fire-and-forget
      }
    },
    [],
  );

  return { logEvent };
};
