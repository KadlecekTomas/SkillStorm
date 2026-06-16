"use client";

import type { JSX, ReactNode } from "react";
import { SaveStatusBadge } from "./save-status-badge";
import type { SaveStatus } from "@/lib/focus-test/types";
import type { TestTimerState } from "@/hooks/focus-test/use-test-timer";
import { cn } from "@/utils/cn";

export interface FocusTestShellProps {
  title: string;
  answeredCount: number;
  totalQuestions: number;
  saveStatus: SaveStatus;
  online: boolean;
  timer: TestTimerState | null;
  children: ReactNode;
}

export function FocusTestShell({
  title,
  answeredCount,
  totalQuestions,
  saveStatus,
  online,
  timer,
  children,
}: FocusTestShellProps): JSX.Element {
  const progressPct =
    totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;
  const timeLow = timer != null && timer.hasLimit && timer.remaining <= 60;

  return (
    <div className="min-h-dvh bg-slate-50" data-testid="focus-test-root">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <h1 className="mr-auto truncate text-base font-semibold text-slate-900">
            {title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {answeredCount}/{totalQuestions}
            </span>
            <span className="hidden sm:inline">zodpovězeno</span>
          </div>

          {timer && (
            <div
              data-testid="focus-timer"
              className={cn(
                "rounded-md px-2 py-1 text-sm font-semibold tabular-nums",
                timeLow ? "bg-red-50 text-red-700" : "text-slate-700",
              )}
            >
              {timer.hasLimit ? "⏱ " : "Konec "}
              {timer.label}
            </div>
          )}

          {!online && (
            <span
              data-testid="offline-indicator"
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              Offline
            </span>
          )}

          <SaveStatusBadge status={saveStatus} />
        </div>
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-1 bg-slate-900 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
