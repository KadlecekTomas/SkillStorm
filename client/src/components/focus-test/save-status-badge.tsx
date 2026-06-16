"use client";

import type { JSX } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import { cn } from "@/utils/cn";

const CONFIG: Record<
  SaveStatus,
  { label: string; dot: string; text: string }
> = {
  idle: { label: "Připraveno", dot: "bg-slate-300", text: "text-slate-500" },
  saving: { label: "Ukládám…", dot: "bg-amber-400", text: "text-amber-700" },
  saved: { label: "Uloženo", dot: "bg-emerald-500", text: "text-emerald-700" },
  offline: {
    label: "Offline – změny se uloží po připojení",
    dot: "bg-slate-400",
    text: "text-slate-600",
  },
  error: { label: "Chyba ukládání", dot: "bg-red-500", text: "text-red-700" },
};

export function SaveStatusBadge({
  status,
}: {
  status: SaveStatus;
}): JSX.Element {
  const cfg = CONFIG[status];
  return (
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
          "h-2 w-2 rounded-full",
          cfg.dot,
          status === "saving" && "animate-pulse",
        )}
      />
      {cfg.label}
    </span>
  );
}
