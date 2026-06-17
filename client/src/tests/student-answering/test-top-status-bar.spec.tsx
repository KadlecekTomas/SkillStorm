/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TestTopStatusBar } from "@/components/student-answering/test-top-status-bar";

const base = {
  variant: "focus" as const,
  title: "Matematika",
  flaggedCount: 0,
  saveStatus: "saved" as const,
  online: true,
  timer: null,
  onReview: vi.fn(),
};

describe("TestTopStatusBar", () => {
  afterEach(cleanup);

  it("shows the current question position as 'Otázka N z M'", () => {
    render(
      <TestTopStatusBar
        {...base}
        currentIndex={2}
        answeredCount={1}
        totalQuestions={12}
      />,
    );
    expect(screen.getByTestId("question-position")).toHaveTextContent(
      "Otázka 3 z 12",
    );
  });

  it("renders the answered percentage", () => {
    render(
      <TestTopStatusBar
        {...base}
        currentIndex={0}
        answeredCount={3}
        totalQuestions={4}
      />,
    );
    // 3/4 = 75 %
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("75 %");
  });

  it("clamps the position label and shows 0 % with no questions answered", () => {
    render(
      <TestTopStatusBar
        {...base}
        currentIndex={0}
        answeredCount={0}
        totalQuestions={5}
      />,
    );
    expect(screen.getByTestId("question-position")).toHaveTextContent(
      "Otázka 1 z 5",
    );
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("0 %");
  });

  it("exposes the review/submit CTA", () => {
    render(
      <TestTopStatusBar
        {...base}
        currentIndex={0}
        answeredCount={0}
        totalQuestions={3}
      />,
    );
    expect(screen.getByTestId("submit-test")).toBeInTheDocument();
  });
});
