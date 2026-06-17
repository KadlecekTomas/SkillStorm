"use client";

import type { JSX } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import { cn } from "@/utils/cn";

export interface ProgressSummaryProps {
  answered: number;
  total: number;
  flagged: number;
  saveStatus: SaveStatus;
  hasUnsaved: boolean;
  timerLabel?: string | null;
  layout?: "row" | "grid";
}

interface Stat {
  key: string;
  label: string;
  value: string | number;
  tone: string;
}

export function ProgressSummary({
  answered,
  total,
  flagged,
  saveStatus,
  hasUnsaved,
  timerLabel,
  layout = "grid",
}: ProgressSummaryProps): JSX.Element {
  const unanswered = Math.max(0, total - answered);
  const syncLabel =
    saveStatus === "saved" && !hasUnsaved
      ? "Vše uloženo"
      : saveStatus === "offline"
        ? "Offline"
        : hasUnsaved || saveStatus === "saving"
          ? "Ukládám…"
          : saveStatus === "error"
            ? "Čeká na synchronizaci"
            : "Vše uloženo";

  const stats: Stat[] = [
    {
      key: "answered",
      label: "Zodpovězeno",
      value: `${answered}/${total}`,
      tone: "text-emerald-700",
    },
    {
      key: "unanswered",
      label: "Bez odpovědi",
      value: unanswered,
      tone: unanswered > 0 ? "text-slate-900" : "text-slate-400",
    },
    {
      key: "flagged",
      label: "K návratu",
      value: flagged,
      tone: flagged > 0 ? "text-amber-700" : "text-slate-400",
    },
    {
      key: "sync",
      label: "Stav uložení",
      value: syncLabel,
      tone:
        saveStatus === "error"
          ? "text-red-700"
          : saveStatus === "offline"
            ? "text-slate-600"
            : "text-slate-900",
    },
  ];

  if (timerLabel) {
    stats.push({
      key: "time",
      label: "Zbývá",
      value: timerLabel,
      tone: "text-slate-900",
    });
  }

  return (
    <dl
      data-testid="progress-summary"
      className={cn(
        layout === "grid"
          ? "grid grid-cols-2 gap-3 sm:grid-cols-4"
          : "flex flex-wrap gap-x-4 gap-y-1",
      )}
    >
      {stats.map((s) => (
        <div
          key={s.key}
          className={cn(
            layout === "grid"
              ? "rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              : "flex items-baseline gap-1.5",
          )}
        >
          <dt
            className={cn(
              "text-xs font-medium text-slate-500",
              layout === "grid" && "mb-0.5",
            )}
          >
            {s.label}
          </dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              layout === "grid" ? "text-base" : "text-sm",
              s.tone,
            )}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
