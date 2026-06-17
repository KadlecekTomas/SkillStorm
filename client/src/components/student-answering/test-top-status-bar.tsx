"use client";

import type { JSX } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import type { TestTimerState } from "@/hooks/focus-test/use-test-timer";
import { cn } from "@/utils/cn";
import { SaveStatusBadge } from "./save-status-badge";
import type { AnsweringVariant } from "./answer-option";

export interface TestTopStatusBarProps {
  variant: AnsweringVariant;
  title: string;
  /** Zero-based index of the question currently shown. */
  currentIndex: number;
  answeredCount: number;
  totalQuestions: number;
  flaggedCount: number;
  saveStatus: SaveStatus;
  online: boolean;
  timer: TestTimerState | null;
  /** Opens the review-before-submit dialog. Never submits directly. */
  onReview: () => void;
  reviewLabel?: string;
}

export function TestTopStatusBar({
  variant,
  title,
  currentIndex,
  answeredCount,
  totalQuestions,
  flaggedCount,
  saveStatus,
  online,
  timer,
  onReview,
  reviewLabel = "Zkontrolovat a odevzdat",
}: TestTopStatusBarProps): JSX.Element {
  const progressPct =
    totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;
  const positionLabel =
    totalQuestions > 0
      ? `Otázka ${Math.min(currentIndex + 1, totalQuestions)} z ${totalQuestions}`
      : "";
  const timeLow = timer != null && timer.hasLimit && timer.remaining <= 60;

  return (
    <header
      data-testid="test-top-status-bar"
      className={cn(
        "sticky top-0 z-20 border-b backdrop-blur",
        variant === "practice"
          ? "border-indigo-100 bg-white/90"
          : "border-slate-200 bg-white/90",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="mr-auto flex min-w-0 flex-col">
          <h1 className="min-w-0 truncate text-base font-semibold text-slate-900">
            {title}
          </h1>
          {positionLabel && (
            <span
              data-testid="question-position"
              aria-live="polite"
              className="text-xs font-medium text-slate-500"
            >
              {positionLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span
            data-testid="progress-percent"
            className="font-semibold tabular-nums text-slate-900"
          >
            {progressPct} %
          </span>
          <span className="hidden text-slate-500 sm:inline">
            ({answeredCount}/{totalQuestions})
          </span>
        </div>

        {flaggedCount > 0 && (
          <span
            data-testid="flagged-count"
            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {flaggedCount} k návratu
          </span>
        )}

        {timer && (
          <div
            data-testid="focus-timer"
            aria-live="polite"
            className={cn(
              "rounded-md px-2 py-1 text-sm font-semibold tabular-nums",
              timeLow
                ? "bg-red-50 text-red-700 motion-safe:animate-pulse"
                : "text-slate-700",
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

        <SaveStatusBadge status={saveStatus} compact />

        <button
          type="button"
          onClick={onReview}
          data-testid="submit-test"
          className={cn(
            "inline-flex h-9 items-center rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            variant === "practice"
              ? "bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500"
              : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500",
          )}
        >
          {reviewLabel}
        </button>
      </div>

      <div
        className="h-1 w-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        aria-label="Průběh testu"
      >
        <div
          className={cn(
            "h-1 transition-all duration-300 motion-reduce:transition-none",
            variant === "practice" ? "bg-indigo-500" : "bg-emerald-500",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
}
