/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InteractiveQuestionCard } from "@/components/student-answering/interactive-question-card";
import { SaveStatusBadge } from "@/components/student-answering/save-status-badge";
import {
  QuestionNavigator,
  type QuestionNavItem,
} from "@/components/student-answering/question-navigator";
import type { FocusQuestion } from "@/lib/focus-test/types";

const question: FocusQuestion = {
  id: "q1",
  text: "Ano nebo ne?",
  type: "TRUE_FALSE",
  options: [],
};

const navItems: QuestionNavItem[] = [
  { answered: true, flagged: false, pending: false },
  { answered: false, flagged: true, pending: true },
];

describe("reduced motion", () => {
  beforeEach(() => {
    // Simulate prefers-reduced-motion: reduce. Components rely on CSS variants only, so the
    // UI must keep working with no JS dependency on animation.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });
  afterEach(cleanup);

  it("renders the answering components without relying on animation", () => {
    render(
      <>
        <SaveStatusBadge status="saving" />
        <InteractiveQuestionCard
          question={question}
          index={0}
          total={1}
          value=""
          onChange={vi.fn()}
          flagged={false}
          onToggleFlag={vi.fn()}
          variant="focus"
        />
        <QuestionNavigator items={navItems} current={0} onSelect={vi.fn()} />
      </>,
    );
    expect(screen.getByTestId("question-card")).toBeInTheDocument();
    expect(screen.getByTestId("save-status")).toBeInTheDocument();
    expect(screen.getAllByTestId("question-nav-item")).toHaveLength(2);
  });
});
