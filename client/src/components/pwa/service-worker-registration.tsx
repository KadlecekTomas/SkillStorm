"use client";

import { useEffect } from "react";

/**
 * Registers the SkillStorm service worker only in production. The worker never
 * caches /api responses or authenticated HTML; offline school data is handled
 * separately by the scoped IndexedDB queue in progress-offline.ts.
 */
export function ServiceWorkerRegistration(): null {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA registration is progressive enhancement. A failed registration must
      // never block the authenticated school application.
    });
  }, []);

  return null;
}
