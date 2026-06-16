"use client";

import { useEffect, useRef } from "react";
import { fetchWithAuth } from "@/lib/http/client";

/**
 * Focus Test Mode telemetry logger.
 *
 * NOT anti-cheat: it never blocks the student and shows nothing in the UI. It listens to
 * tab blur / visibility / connectivity events and ships them fire-and-forget to the backend
 * audit log for later review. Events are deduplicated per type (one row per ~12s, with an
 * aggregated count) and batched. Any logging failure is swallowed so it can never affect the
 * test runner, autosave or submit.
 */
type FocusEventType =
  | "window_blur"
  | "window_focus"
  | "visibility_hidden"
  | "visibility_visible"
  | "offline"
  | "online";

interface BufferedEvent {
  type: FocusEventType;
  clientTimestamp: number;
  count: number;
}

const DEDUP_MS = 12_000;
const FLUSH_DEBOUNCE_MS = 3_000;

export function useFocusEventLogger(
  submissionId: string,
  enabled = true,
): void {
  const bufferRef = useRef<BufferedEvent[]>([]);
  const lastByTypeRef = useRef<Map<FocusEventType, { ts: number; index: number }>>(
    new Map(),
  );
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !submissionId) return;

    const flush = (): void => {
      const events = bufferRef.current;
      if (events.length === 0) return;
      bufferRef.current = [];
      lastByTypeRef.current.clear();
      // Fire-and-forget — failures must never surface to the student or block the test.
      void fetchWithAuth("POST", `/submissions/${submissionId}/focus-events`, {
        body: { events },
      }).catch(() => {});
    };

    const scheduleFlush = (): void => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(flush, FLUSH_DEBOUNCE_MS);
    };

    const record = (type: FocusEventType): void => {
      try {
        const now = Date.now();
        const last = lastByTypeRef.current.get(type);
        if (last && now - last.ts < DEDUP_MS) {
          const item = bufferRef.current[last.index];
          if (item) item.count += 1;
        } else {
          bufferRef.current.push({ type, clientTimestamp: now, count: 1 });
          lastByTypeRef.current.set(type, {
            ts: now,
            index: bufferRef.current.length - 1,
          });
        }
        scheduleFlush();
      } catch {
        // Never let telemetry break the test.
      }
    };

    const onVisibility = (): void =>
      record(
        document.visibilityState === "hidden"
          ? "visibility_hidden"
          : "visibility_visible",
      );
    const onBlur = (): void => record("window_blur");
    const onFocus = (): void => record("window_focus");
    const onOffline = (): void => record("offline");
    const onOnline = (): void => record("online");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flush();
    };
  }, [submissionId, enabled]);
}
