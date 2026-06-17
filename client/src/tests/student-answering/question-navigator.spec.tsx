/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  QuestionNavigator,
  type QuestionNavItem,
} from "@/components/student-answering/question-navigator";

const items: QuestionNavItem[] = [
  { answered: true, flagged: false, pending: false, started: false }, // 1 answered
  { answered: false, flagged: false, pending: false, started: false }, // 2 unanswered
  { answered: false, flagged: true, pending: false, started: false }, // 3 flagged
  { answered: true, flagged: false, pending: true, started: false }, // 4 pending
  { answered: false, flagged: false, pending: false, started: true }, // 5 started (rozepsaná)
];

describe("QuestionNavigator", () => {
  afterEach(cleanup);

  it("reflects current / answered / unanswered / flagged / pending / started state", () => {
    render(<QuestionNavigator items={items} current={1} onSelect={vi.fn()} />);
    const dots = screen.getAllByTestId("question-nav-item");
    expect(dots).toHaveLength(5);

    expect(dots[0]).toHaveAttribute("data-answered", "true");
    expect(dots[0]).toHaveAttribute("data-current", "false");

    expect(dots[1]).toHaveAttribute("data-current", "true");
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).toHaveAttribute("data-answered", "false");

    expect(dots[2]).toHaveAttribute("data-flagged", "true");
    expect(dots[3]).toHaveAttribute("data-pending", "true");

    // "Rozepsaná" — visited but unanswered.
    expect(dots[4]).toHaveAttribute("data-started", "true");
    expect(dots[4]).toHaveAttribute("data-answered", "false");
  });

  it("labels a started question as rozepsaná for screen readers", () => {
    render(<QuestionNavigator items={items} current={0} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Otázka 5.*rozepsaná/i)).toBeInTheDocument();
  });

  it("invokes onSelect with the clicked question index", () => {
    const onSelect = vi.fn();
    render(<QuestionNavigator items={items} current={0} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByTestId("question-nav-item")[2]!);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("gives each dot a descriptive accessible label", () => {
    render(<QuestionNavigator items={items} current={0} onSelect={vi.fn()} />);
    expect(
      screen.getByLabelText(/Otázka 3.*označeno k návratu/i),
    ).toBeInTheDocument();
  });
});
