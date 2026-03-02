"use client";

import { API_BASE_PATH } from "@/utils/env";
import { createCorrelationId } from "@/lib/http/client";
import { useAuthStore } from "@/store/use-auth-store";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "TEST_OPEN"
  | "SUBMISSION_START"
  | "SUBMISSION_FINISH"
  | "ACCESS_REQUEST";

export type AuditEvent = {
  action: AuditAction;
  entityId?: string;
  meta?: Record<string, unknown>;
  ts: number;
  cid: string;
};

type AuditInput = Omit<AuditEvent, "ts" | "cid"> & {
  cid?: string;
};

const AUDIT_ENDPOINT = `${API_BASE_PATH}/audit`;
const queue: AuditEvent[] = [];
let flushing = false;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const isBrowser = typeof window !== "undefined";

const enqueueRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  const delay = Math.min(3000, 250 * 2 ** retryAttempt);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    flushAuditQueue();
  }, delay);
};

const canFlush = () => {
  if (!isBrowser) return true;
  return navigator.onLine;
};

const sendViaBeacon = (payload: AuditEvent[]) => {
  if (!isBrowser || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  const blob = new Blob([JSON.stringify({ events: payload })], {
    type: "application/json",
  });
  return navigator.sendBeacon(AUDIT_ENDPOINT, blob);
};

export const audit = (event: AuditInput): void => {
  const state = useAuthStore.getState();
  if (!state.user || state.authPhase === "LOGGING_OUT") return;
  if (state.context?.mode === "organization" && state.org?.bootstrap?.hasAcademicYear === false) return;
  const enriched: AuditEvent = {
    action: event.action,
    ts: Date.now(),
    cid: event.cid ?? createCorrelationId(),
    ...(typeof event.entityId === "string" ? { entityId: event.entityId } : {}),
    ...(event.meta ? { meta: event.meta } : {}),
  };
  queue.push(enriched);
  void flushAuditQueue();
};

export const flushAuditQueue = async (options?: {
  force?: boolean;
  useBeacon?: boolean;
}): Promise<boolean> => {
  if (!queue.length || flushing) return true;
  const authState = useAuthStore.getState();
  if (authState.authPhase === "LOGGING_OUT") return false;
  if (authState.context?.mode === "organization" && authState.org?.bootstrap?.hasAcademicYear === false) return false;
  if (!options?.force && !canFlush()) return false;

  const payload = queue.splice(0, queue.length);
  flushing = true;
  const useBeacon = options?.useBeacon ?? false;

  try {
    if (useAuthStore.getState().authPhase === "LOGGING_OUT") {
      queue.unshift(...payload);
      return false;
    }
    if (useBeacon && sendViaBeacon(payload)) {
      retryAttempt = 0;
      return true;
    }

    await fetch(AUDIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: payload }),
      keepalive: useBeacon,
      credentials: "include",
    });
    retryAttempt = 0;
    return true;
  } catch {
    queue.unshift(...payload);
    enqueueRetry();
    return false;
  } finally {
    flushing = false;
  }
};

if (isBrowser) {
  window.addEventListener("beforeunload", () => {
    flushAuditQueue({ force: true, useBeacon: true }).catch(() => undefined);
  });
  window.addEventListener("online", () => {
    retryAttempt = 0;
    flushAuditQueue().catch(() => undefined);
  });
}
