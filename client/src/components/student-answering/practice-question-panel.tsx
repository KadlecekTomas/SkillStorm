"use client";

import type { JSX } from "react";
import { useState } from "react";
import type { FocusQuestion } from "@/lib/focus-test/types";
import { AnswerOption, type AnswerOptionState } from "./answer-option";

/**
 * Practice Mode building block — PREPARED, NOT WIRED TO A ROUTE.
 *
 * This is the scaffold for a future, lower-stakes Practice Mode. Unlike Focus Test Mode it MAY
 * reveal correctness, hints and encouragement after an answer. It deliberately lives outside
 * the focus route: the Focus runner only ever renders `variant="focus"`, where AnswerOption
 * shows no correct/incorrect styling before submit. Backend support is intentionally absent —
 * a parent that adopts this is responsible for supplying the evaluation.
 */
export interface PracticeQuestionPanelProps {
  question: FocusQuestion;
  /** Evaluate a chosen value. Returns whether it is correct. Supplied by a future Practice host. */
  evaluate: (value: string) => boolean;
  onContinue?: () => void;
}

export function PracticeQuestionPanel({
  question,
  evaluate,
  onContinue,
}: PracticeQuestionPanelProps): JSX.Element {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);

  const options =
    question.type === "MULTIPLE_CHOICE"
      ? question.options.map((o) => ({ id: o.id, value: o.text, label: o.text }))
      : question.type === "TRUE_FALSE"
        ? [
            { id: "true", value: "true", label: "Ano" },
            { id: "false", value: "false", label: "Ne" },
          ]
        : [];

  const resultFor = (optValue: string): AnswerOptionState => {
    if (!checked) return "none";
    if (optValue === value) return evaluate(optValue) ? "correct" : "incorrect";
    return "none";
  };

  const isCorrect = checked && evaluate(value);

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-100 bg-white p-6 shadow-soft">
      <p className="text-lg font-medium text-slate-900">{question.text}</p>

      <div
        role="radiogroup"
        aria-label="Možnosti odpovědi"
        className="space-y-3"
      >
        {options.map((opt, i) => (
          <AnswerOption
            key={opt.id}
            name={`practice-${question.id}`}
            value={opt.value}
            label={opt.label}
            shortcut={i + 1}
            selected={value === opt.value}
            onSelect={(v) => {
              setValue(v);
              setChecked(false);
            }}
            disabled={checked}
            variant="practice"
            state={resultFor(opt.value)}
          />
        ))}
      </div>

      {checked && (
        <p
          className={
            isCorrect
              ? "rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 motion-safe:animate-in motion-safe:fade-in"
              : "rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 motion-safe:animate-in motion-safe:fade-in"
          }
        >
          {isCorrect ? "Správně! Skvělá práce." : "Ještě ne — zkus to znovu."}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {!checked ? (
          <button
            type="button"
            onClick={() => setChecked(true)}
            disabled={value === ""}
            className="inline-flex h-11 items-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Zkontrolovat
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-11 items-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Pokračovat
          </button>
        )}
      </div>
    </section>
  );
}
