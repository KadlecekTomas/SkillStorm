"use client";

import { useEffect } from "react";

export interface AnsweringKeyboardHandlers {
  /** Whether shortcuts are active (disable e.g. while a dialog is open). */
  enabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleFlag: () => void;
  /** Open the review dialog (Ctrl/Cmd+Enter). Never submits directly. */
  onOpenReview: () => void;
  /** Select the option at the given zero-based index (digit keys 1–9). */
  onSelectOption: (index: number) => void;
  /** Number of selectable options for the current question (0 for text answers). */
  optionCount: number;
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

/**
 * Safe keyboard control for the answering experience.
 *
 * Hard rules:
 *  - Single-key shortcuts (arrows, digits, F/M) are IGNORED while the user is typing in a
 *    text field, so they never clobber a FILL_IN_THE_BLANK answer.
 *  - Ctrl/Cmd+Enter opens the review dialog (it deliberately does NOT submit) and works even
 *    from inside an input.
 *  - Any modifier combination other than the explicit review combo is left to the browser.
 */
export function useAnsweringKeyboard({
  enabled = true,
  onPrev,
  onNext,
  onToggleFlag,
  onOpenReview,
  onSelectOption,
  optionCount,
}: AnsweringKeyboardHandlers): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent): void => {
      // Review: Ctrl/Cmd+Enter — allowed everywhere, including inputs.
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onOpenReview();
        return;
      }

      // Everything below is a single, unmodified key.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onPrev();
          return;
        case "ArrowRight":
          e.preventDefault();
          onNext();
          return;
        case "f":
        case "F":
        case "m":
        case "M":
          e.preventDefault();
          onToggleFlag();
          return;
        default:
          break;
      }

      if (optionCount > 0 && /^[1-9]$/.test(e.key)) {
        const index = Number(e.key) - 1;
        if (index < optionCount) {
          e.preventDefault();
          onSelectOption(index);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enabled,
    onPrev,
    onNext,
    onToggleFlag,
    onOpenReview,
    onSelectOption,
    optionCount,
  ]);
}
