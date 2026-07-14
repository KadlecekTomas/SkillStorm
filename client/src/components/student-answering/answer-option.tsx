"use client";

import type { JSX } from "react";
import { cn } from "@/utils/cn";

export type AnsweringVariant = "focus" | "practice";

/**
 * Practice-only result state. In Focus Mode the value is ALWAYS "none" — no correct/incorrect
 * styling is rendered before submit, which keeps the answer key out of the UI.
 */
export type AnswerOptionState = "none" | "correct" | "incorrect";

export interface AnswerOptionProps {
  /** Radio group name (the question id) so a keyboard user can arrow between options. */
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: (value: string) => void;
  /** 1-based hint shown as a keyboard affordance (digit keys select an option). */
  shortcut?: number;
  disabled?: boolean;
  variant?: AnsweringVariant;
  /** Practice feedback. Ignored in Focus Mode. */
  state?: AnswerOptionState;
  /**
   * Young-mode tile look: big centered tactile tile with an optional icon
   * (design reference: young 2×2 grid). Presentation only — the radio overlay
   * and selection semantics are identical to the default list look.
   */
  tile?: boolean;
  /** Decorative emoji shown on tiles (young mode). */
  tileIcon?: string;
}

export function AnswerOption({
  name,
  value,
  label,
  selected,
  onSelect,
  shortcut,
  disabled = false,
  variant = "focus",
  state = "none",
  tile = false,
  tileIcon,
}: AnswerOptionProps): JSX.Element {
  // Result styling is exclusive to Practice Mode and only after it is explicitly provided.
  const showResult = variant === "practice" && state !== "none";

  return (
    <label
      data-testid="answer-option"
      data-selected={selected}
      data-state={showResult ? state : undefined}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border text-left transition-all duration-150 motion-reduce:transition-none",
        "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent/70",
        disabled && "cursor-not-allowed opacity-60",
        tile
          ? "flex-col justify-center gap-2 px-3 py-6 text-center text-xl font-extrabold shadow-tactile [--tactile-shadow:rgb(var(--line-strong))] active:translate-y-[2px] active:shadow-tactile-pressed"
          : "px-4 py-3.5 text-base",
        tile && selected && "[--tactile-shadow:rgb(var(--accent-deep))]",
        !showResult && selected
          ? "border-accent bg-accent-soft/70 ring-1 ring-accent"
          : !showResult &&
              cn(
                "border-line bg-canvas hover:border-accent/60",
                tile ? "border-2 border-line-strong" : "hover:bg-canvas-alt",
              ),
        showResult &&
          state === "correct" &&
          "border-accent bg-accent-soft ring-1 ring-accent",
        showResult &&
          state === "incorrect" &&
          "border-danger bg-danger-soft ring-1 ring-danger",
      )}
    >
      {/*
        A real radio kept in the accessibility tree (native keyboard arrow-selection + SR
        announcement), but stretched transparently over the whole option so a click anywhere —
        or a programmatic .check() — lands on the input itself with nothing intercepting it.
      */}
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-2xl opacity-0 disabled:cursor-not-allowed"
      />

      {tile && tileIcon && (
        <span aria-hidden="true" className="text-3xl leading-none">
          {tileIcon}
        </span>
      )}

      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors motion-reduce:transition-none",
          tile && "absolute right-2.5 top-2.5",
          selected
            ? "border-accent bg-accent text-white"
            : cn(
                "border-line-strong bg-canvas text-ink-dim group-hover:border-accent/60",
                tile && "opacity-0",
              ),
        )}
      >
        {selected ? (
          // Check mark — selection is conveyed by shape, not colour alone.
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.9a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          !tile && shortcut != null && shortcut <= 9 && <span>{shortcut}</span>
        )}
      </span>

      <span className={cn("text-ink", tile ? "font-extrabold" : "font-medium")}>
        {label}
      </span>
    </label>
  );
}
