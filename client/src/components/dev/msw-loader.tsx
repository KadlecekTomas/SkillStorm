"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __MSW_READY__?: boolean;
    __MSW_RESET__?: () => Promise<void> | void;
    __MSW_EXPIRE__?: () => Promise<void> | void;
    __MSW_AUDIT__?: () => Promise<unknown[]> | unknown[];
  }
}

const shouldEnable = process.env.NEXT_PUBLIC_ENABLE_MSW === "true";

const assignTestingHelpers = () => {
  window.__MSW_RESET__ = async () => {
    try {
      await fetch("/api/testing/reset", { method: "POST" });
    } catch {
      // ignore reset network errors
    } finally {
      window.localStorage.removeItem("skillstorm_auth");
    }
  };

  window.__MSW_EXPIRE__ = async () => {
    try {
      await fetch("/api/testing/expire-token", { method: "POST" });
    } catch {
      // ignore
    }
  };

  window.__MSW_AUDIT__ = async () => {
    try {
      const response = await fetch("/api/testing/audit-log");
      const payload = (await response.json()) as { events?: unknown[] };
      return Array.isArray(payload?.events) ? payload.events : [];
    } catch {
      return [];
    }
  };
};

export const MswLoader = (): React.ReactNode => {
  useEffect(() => {
    let cancelled = false;
    window.__MSW_READY__ = false;

    if (!shouldEnable) {
      assignTestingHelpers();
      window.__MSW_READY__ = true;
      return () => {
        cancelled = true;
      };
    }

    import("@/mocks/browser")
      .then(({ startMockWorker }) => {
        if (cancelled) {
          return undefined;
        }
        return startMockWorker().then(() => {
          if (!cancelled) {
            window.__MSW_READY__ = true;
          }
        });
      })
      .catch(() => {
        assignTestingHelpers();
        window.__MSW_READY__ = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};
