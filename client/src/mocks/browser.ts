"use client";

import { setupWorker } from "msw/browser";
import { handlers } from "@/mocks/handlers";
import { resetMockState, expireTokenOnce, getAuditEventsSnapshot } from "@/mocks/state";

declare global {
  interface Window {
    __MSW_RESET__?: () => Promise<void> | void;
    __MSW_EXPIRE__?: () => Promise<void> | void;
    __MSW_AUDIT__?: () => Promise<unknown[]> | unknown[];
  }
}

const worker = setupWorker(...handlers);
const MSW_SESSION_TOKEN = "msw-browser";

export const startMockWorker = async () => {
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: {
      url: "/mockServiceWorker.js",
    },
  });
  window.__MSW_RESET__ = async () => {
    resetMockState();
  };
  window.__MSW_EXPIRE__ = async () => {
    expireTokenOnce(MSW_SESSION_TOKEN);
  };
  window.__MSW_AUDIT__ = async () => getAuditEventsSnapshot();
};
