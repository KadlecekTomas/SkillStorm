"use client";

import type { JSX } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import { cn } from "@/utils/cn";

/**
 * Visual representation of the autosave state. Purely presentational — it reflects the
 * `SaveStatus` produced by `useFocusTest` and never drives any save/sync logic itself.
 */
const CONFIG: Record<
  SaveStatus,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  idle: { label: "Připraveno", dot: "bg-slate-300", text: "text-slate-500" },
  saving: {
    label: "Ukládám…",
    dot: "bg-amber-400",
    text: "text-amber-700",
    pulse: true,
  },
  saved: {
    label: "Uloženo",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  offline: {
    label: "Offline – uloženo v zařízení",
    dot: "bg-slate-400",
    text: "text-slate-600",
  },
  error: {
    label: "Čeká na synchronizaci",
    dot: "bg-red-500",
    text: "text-red-700",
    pulse: true,
  },
};

export interface SaveStatusBadgeProps {
  status: SaveStatus;
  /** Compact mode hides the text label on very small screens. */
  compact?: boolean;
}

export function SaveStatusBadge({
  status,
  compact = false,
}: SaveStatusBadgeProps): JSX.Element {
  const cfg = CONFIG[status];
  return (
    <span
      data-testid="save-status-badge"
      className="inline-flex items-center"
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium",
          cfg.text,
        )}
        aria-live="polite"
        data-testid="save-status"
        data-status={status}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            cfg.dot,
            cfg.pulse && "motion-safe:animate-pulse",
          )}
        />
        <span className={cn(compact && "sr-only sm:not-sr-only")}>
          {cfg.label}
        </span>
      </span>
    </span>
  );
}
