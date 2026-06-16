"use client";

import type { JSX } from "react";
import { Card } from "@/components/ui/card";
import type { FocusQuestion } from "@/lib/focus-test/types";
import { cn } from "@/utils/cn";

export interface QuestionCardProps {
  question: FocusQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
}

const optionClasses = (selected: boolean): string =>
  cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition",
    selected
      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
      : "border-slate-200 hover:border-slate-400",
  );

export function QuestionCard({
  question,
  index,
  total,
  value,
  onChange,
}: QuestionCardProps): JSX.Element {
  return (
    <Card className="space-y-5 p-6" data-testid="focus-question">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Otázka {index + 1} / {total}
        </p>
        <p className="text-lg font-medium text-slate-900">{question.text}</p>
      </div>

      {question.type === "TRUE_FALSE" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { v: "true", label: "Ano" },
            { v: "false", label: "Ne" },
          ].map((opt) => (
            <label key={opt.v} className={optionClasses(value === opt.v)}>
              <input
                type="radio"
                name={question.id}
                value={opt.v}
                checked={value === opt.v}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === "FILL_IN_THE_BLANK" && (
        <input
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Napiš odpověď"
          autoComplete="off"
        />
      )}

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="space-y-3">
          {question.options.map((opt) => (
            <label key={opt.id} className={optionClasses(value === opt.text)}>
              <input
                type="radio"
                name={question.id}
                value={opt.text}
                checked={value === opt.text}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4"
              />
              <span>{opt.text}</span>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}
