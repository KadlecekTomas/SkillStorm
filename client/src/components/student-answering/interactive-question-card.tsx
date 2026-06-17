"use client";

import type { JSX } from "react";
import type { FocusQuestion } from "@/lib/focus-test/types";
import { isAnswered } from "@/lib/focus-test/draft-storage";
import { cn } from "@/utils/cn";
import { AnswerOption, type AnsweringVariant } from "./answer-option";

const TYPE_LABEL: Record<FocusQuestion["type"], string> = {
  MULTIPLE_CHOICE: "Výběr odpovědi",
  TRUE_FALSE: "Ano / Ne",
  FILL_IN_THE_BLANK: "Doplň odpověď",
};

export interface InteractiveQuestionCardProps {
  question: FocusQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  variant?: AnsweringVariant;
}

/**
 * A single question with its answer surface.
 *
 * SECURITY: this component is rendered only from the sanitized student session payload
 * (`FocusQuestion`), which carries no `correctAnswer`/`correctAnswers`/`explanation`. It must
 * never receive or render those fields — there is nothing here that could leak an answer key.
 */
export function InteractiveQuestionCard({
  question,
  index,
  total,
  value,
  onChange,
  flagged,
  onToggleFlag,
  variant = "focus",
}: InteractiveQuestionCardProps): JSX.Element {
  const answered = isAnswered(value);

  return (
    <section
      key={question.id}
      data-testid="question-card"
      data-answered={answered}
      data-flagged={flagged}
      aria-labelledby={`q-${question.id}-text`}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Otázka {index + 1} / {total}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {TYPE_LABEL[question.type]}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              answered ? "text-emerald-700" : "text-slate-400",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                answered ? "bg-emerald-500" : "bg-slate-300",
              )}
            />
            {answered ? "Zodpovězeno" : "Bez odpovědi"}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleFlag}
          aria-pressed={flagged}
          data-testid="flag-question"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500",
            flagged
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700",
          )}
        >
          <svg
            viewBox="0 0 20 20"
            fill={flagged ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={flagged ? 0 : 1.6}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M5 3v14M5 4h9l-1.5 3L14 10H5" strokeLinejoin="round" />
          </svg>
          {flagged ? "Označeno" : "Označit k návratu"}
        </button>
      </div>

      <p
        id={`q-${question.id}-text`}
        className="text-lg font-medium leading-relaxed text-slate-900"
      >
        {question.text}
      </p>

      {question.type === "TRUE_FALSE" && (
        <div
          role="radiogroup"
          aria-label="Možnosti odpovědi"
          className="grid gap-3 sm:grid-cols-2"
        >
          {[
            { v: "true", label: "Ano" },
            { v: "false", label: "Ne" },
          ].map((opt, i) => (
            <AnswerOption
              key={opt.v}
              name={question.id}
              value={opt.v}
              label={opt.label}
              shortcut={i + 1}
              selected={value === opt.v}
              onSelect={onChange}
              variant={variant}
            />
          ))}
        </div>
      )}

      {question.type === "MULTIPLE_CHOICE" && (
        <div
          role="radiogroup"
          aria-label="Možnosti odpovědi"
          className="space-y-3"
        >
          {question.options.map((opt, i) => (
            <AnswerOption
              key={opt.id}
              name={question.id}
              value={opt.text}
              label={opt.text}
              shortcut={i + 1}
              selected={value === opt.text}
              onSelect={onChange}
              variant={variant}
            />
          ))}
        </div>
      )}

      {question.type === "FILL_IN_THE_BLANK" && (
        <input
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base transition-colors motion-reduce:transition-none focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Napiš odpověď"
          autoComplete="off"
          aria-label="Odpověď"
        />
      )}
    </section>
  );
}
