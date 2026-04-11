"use client";

import { useCallback } from "react";
import { httpClient } from "@/lib/http/client";

export const useAnalytics = (): { logEvent: (category: string, action: string, metadata?: Record<string, unknown>) => Promise<void> } => {
  const logEvent = useCallback(
    (
      category: string,
      action: string,
      metadata?: Record<string, unknown>,
    ): Promise<void> =>
      httpClient
        .post("/analytics/log", {
          category,
          action,
          metadata: metadata ?? null,
        })
        .then(() => undefined),
    [],
  );

  return { logEvent };
};
