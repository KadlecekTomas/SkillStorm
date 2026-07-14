"use client";

import type { JSX } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import type { TestTimerState } from "@/hooks/focus-test/use-test-timer";
import type { AnsweringMode } from "@/config/answering-mode";
import { cn } from "@/utils/cn";
import { PartakEmblem } from "@/components/partak";
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
  /** Věkový režim: "young" zjednodušuje bar (bez flagů, tlumený časovač). */
  mode?: AnsweringMode;
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
  mode = "old",
}: TestTopStatusBarProps): JSX.Element {
  const young = mode === "young";
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
          ? "border-xp/20 bg-canvas/90"
          : "border-line bg-canvas/90",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="hidden shrink-0 sm:block" aria-hidden="true">
            <PartakEmblem size={30} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="min-w-0 truncate text-base font-bold text-ink">
              {title}
            </h1>
            {positionLabel && (
              <span
                data-testid="question-position"
                aria-live="polite"
                className="text-xs font-medium text-ink-muted"
              >
                {positionLabel}
              </span>
            )}
          </div>
        </div>

        {!young && (
          <div className="flex items-center gap-1.5 text-sm text-ink-muted">
            <span
              data-testid="progress-percent"
              className="font-bold tabular-nums text-ink"
            >
              {progressPct} %
            </span>
            <span className="hidden text-ink-dim sm:inline">
              ({answeredCount}/{totalQuestions})
            </span>
          </div>
        )}

        {!young && flaggedCount > 0 && (
          <span
            data-testid="flagged-count"
            className="inline-flex items-center gap-1 rounded-full bg-streak/10 px-2.5 py-1 text-xs font-bold text-streak"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-streak" />
            {flaggedCount} k návratu
          </span>
        )}

        {timer && (
          <div
            data-testid="focus-timer"
            aria-live="polite"
            className={cn(
              "rounded-md px-2 py-1 tabular-nums",
              // Mladší režim: časovač zůstává viditelný (běžící limit se nikdy neskrývá),
              // jen je menší a tlumený; urgentní stav zvýrazňujeme v obou režimech.
              young ? "text-xs font-semibold" : "text-sm font-bold",
              timeLow
                ? "bg-danger-soft text-danger-deep motion-safe:animate-pulse"
                : young
                  ? "text-ink-dim"
                  : "text-ink-muted",
            )}
          >
            {timer.hasLimit ? "⏱ " : "Konec "}
            {timer.label}
          </div>
        )}

        {!online && (
          <span
            data-testid="offline-indicator"
            className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-ink-muted"
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
            "inline-flex h-10 items-center rounded-2xl px-4 text-sm font-bold text-white shadow-tactile transition-all duration-100 motion-reduce:transition-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-xp active:translate-y-[2px] active:shadow-tactile-pressed",
            variant === "practice"
              ? "bg-xp [--tactile-shadow:#0e7ab8] hover:brightness-105"
              : "bg-accent [--tactile-shadow:rgb(var(--accent-deep))] hover:bg-accent-hover",
          )}
        >
          {reviewLabel}
        </button>
      </div>

      <div
        className="h-1 w-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        aria-label="Průběh testu"
      >
        <div
          className={cn(
            "h-1 transition-all duration-300 motion-reduce:transition-none",
            variant === "practice" ? "bg-xp" : "bg-accent",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
}
