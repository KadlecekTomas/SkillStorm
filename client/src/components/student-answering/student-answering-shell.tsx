"use client";

import type { JSX, ReactNode } from "react";
import type { SaveStatus } from "@/lib/focus-test/types";
import type { TestTimerState } from "@/hooks/focus-test/use-test-timer";
import { cn } from "@/utils/cn";
import { TestTopStatusBar } from "./test-top-status-bar";
import type { AnsweringVariant } from "./answer-option";

export interface AnsweringProgress {
  /** Zero-based index of the question currently shown. */
  current: number;
  answered: number;
  total: number;
  flagged: number;
}

export interface StudentAnsweringShellProps {
  variant: AnsweringVariant;
  title: string;
  progress: AnsweringProgress;
  timer: TestTimerState | null;
  saveStatus: SaveStatus;
  onlineStatus: boolean;
  onReview: () => void;
  reviewLabel?: string;
  children: ReactNode;
}

/**
 * Chrome-free shell for the student answering experience.
 *
 * In the "focus" variant this is a calm, distraction-free testing surface: no sidebar, no
 * dashboard nav, a single readable column and a sticky status bar. The "practice" variant
 * shares the structure with a softer, more playful palette and is intentionally NOT wired to
 * a route yet — it exists so a future Practice Mode can reuse the same building blocks.
 */
export function StudentAnsweringShell({
  variant,
  title,
  progress,
  timer,
  saveStatus,
  onlineStatus,
  onReview,
  reviewLabel,
  children,
}: StudentAnsweringShellProps): JSX.Element {
  return (
    <div
      data-testid="focus-test-root"
      data-variant={variant}
      className={cn(
        "min-h-dvh",
        variant === "practice"
          ? "bg-gradient-to-b from-indigo-50/60 to-slate-50"
          : "bg-slate-50",
      )}
    >
      <TestTopStatusBar
        variant={variant}
        title={title}
        currentIndex={progress.current}
        answeredCount={progress.answered}
        totalQuestions={progress.total}
        flaggedCount={progress.flagged}
        saveStatus={saveStatus}
        online={onlineStatus}
        timer={timer}
        onReview={onReview}
        {...(reviewLabel ? { reviewLabel } : {})}
      />

      <main
        data-testid="focus-test-shell"
        className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8"
      >
        {children}
      </main>
    </div>
  );
}
