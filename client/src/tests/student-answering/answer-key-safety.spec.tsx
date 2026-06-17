/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InteractiveQuestionCard } from "@/components/student-answering/interactive-question-card";
import type { FocusQuestion } from "@/lib/focus-test/types";

// A question object deliberately polluted with answer-key-shaped fields to prove they are
// never rendered by the pre-submit UI, regardless of what an upstream payload might carry.
const pollutedMc = {
  id: "q1",
  text: "Kolik je 2 + 2?",
  type: "MULTIPLE_CHOICE",
  options: [
    { id: "o1", text: "3" },
    { id: "o2", text: "4" },
  ],
  // Fields that MUST NOT leak into the focus UI:
  correctAnswer: "SECRET-CORRECT-4",
  correctAnswers: ["SECRET-CORRECT-4"],
  explanation: "SECRET-EXPLANATION",
} as unknown as FocusQuestion;

describe("Focus answer-key safety", () => {
  afterEach(cleanup);

  it("never renders correctAnswer / correctAnswers / explanation in the question card", () => {
    const { container } = render(
      <InteractiveQuestionCard
        question={pollutedMc}
        index={0}
        total={1}
        value=""
        onChange={vi.fn()}
        flagged={false}
        onToggleFlag={vi.fn()}
        variant="focus"
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain("SECRET-CORRECT-4");
    expect(html).not.toContain("SECRET-EXPLANATION");
  });

  it("renders no correct/incorrect result styling on options before submit (focus mode)", () => {
    render(
      <InteractiveQuestionCard
        question={pollutedMc}
        index={0}
        total={1}
        value="4"
        onChange={vi.fn()}
        flagged={false}
        onToggleFlag={vi.fn()}
        variant="focus"
      />,
    );
    for (const opt of screen.getAllByTestId("answer-option")) {
      expect(opt).not.toHaveAttribute("data-state");
    }
  });
});
