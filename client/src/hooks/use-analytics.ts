"use client";

import { useCallback } from "react";
import { httpClient } from "@/lib/http/client";

export const useAnalytics = () => {
  const logEvent = useCallback(
    async (
      category: string,
      action: string,
      metadata?: Record<string, unknown>,
    ) => {
      try {
        await httpClient.post("/analytics/log", {
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
