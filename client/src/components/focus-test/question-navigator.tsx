"use client";

import type { JSX } from "react";
import { cn } from "@/utils/cn";

export interface QuestionNavigatorProps {
  total: number;
  current: number;
  answered: boolean[];
  onSelect: (index: number) => void;
}

export function QuestionNavigator({
  total,
  current,
  answered,
  onSelect,
}: QuestionNavigatorProps): JSX.Element {
  return (
    <nav aria-label="Navigace otázek" data-testid="question-navigator">
      <ol className="flex flex-wrap gap-2">
        {Array.from({ length: total }, (_, i) => {
          const isCurrent = i === current;
          const isAnswered = answered[i] ?? false;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "true" : undefined}
                data-answered={isAnswered}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition",
                  isCurrent
                    ? "border-slate-900 bg-slate-900 text-white"
                    : isAnswered
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400",
                )}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
