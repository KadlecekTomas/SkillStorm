"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeDeadlineMs,
  formatRemaining,
  remainingSeconds,
  type TimerInputs,
} from "@/lib/focus-test/timer";

export interface TestTimerState {
  /** Whether a time limit applies (vs. only a close time). */
  hasLimit: boolean;
  remaining: number;
  label: string;
  expired: boolean;
}

/**
 * Informational countdown anchored to the server start. On expiry it fires onExpire once;
 * the server remains the final authority on whether a submission is still valid.
 */
export function useTestTimer(
  inputs: TimerInputs | null,
  onExpire?: () => void,
): TestTimerState | null {
  const deadlineMs = useMemo(
    () => (inputs ? computeDeadlineMs(inputs) : null),
    [inputs],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (deadlineMs == null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  useEffect(() => {
    if (deadlineMs == null) return;
    if (!firedRef.current && Date.now() >= deadlineMs) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [nowMs, deadlineMs, onExpire]);

  if (inputs == null || deadlineMs == null) return null;
  const remaining = remainingSeconds(deadlineMs, nowMs);
  return {
    hasLimit: inputs.timeLimitSec != null,
    remaining,
    label: formatRemaining(remaining),
    expired: remaining <= 0,
  };
}
