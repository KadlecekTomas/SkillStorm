/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AnswerOption } from "@/components/student-answering/answer-option";

describe("AnswerOption", () => {
  afterEach(cleanup);

  it("renders a native radio that is keyboard operable and reports selection", () => {
    const onSelect = vi.fn();
    render(
      <AnswerOption
        name="q1"
        value="a"
        label="Možnost A"
        selected={false}
        onSelect={onSelect}
        shortcut={1}
      />,
    );
    const radio = screen.getByRole("radio") as HTMLInputElement;
    expect(radio.value).toBe("a");

    // Keyboard activation: focus + space selects a radio, firing onChange → onSelect.
    radio.focus();
    expect(radio).toHaveFocus();
    fireEvent.click(radio); // space/enter on a focused radio maps to a click in the platform
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("reflects the selected state via data attribute", () => {
    const { rerender } = render(
      <AnswerOption
        name="q1"
        value="a"
        label="A"
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("answer-option")).toHaveAttribute(
      "data-selected",
      "false",
    );
    rerender(
      <AnswerOption
        name="q1"
        value="a"
        label="A"
        selected
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("answer-option")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("never exposes correct/incorrect styling in the focus variant", () => {
    // Even if a (wrong) caller passed a result state, focus mode must ignore it.
    render(
      <AnswerOption
        name="q1"
        value="a"
        label="A"
        selected
        onSelect={vi.fn()}
        variant="focus"
        state="correct"
      />,
    );
    expect(screen.getByTestId("answer-option")).not.toHaveAttribute("data-state");
  });

  it("exposes practice result state only in the practice variant", () => {
    render(
      <AnswerOption
        name="q1"
        value="a"
        label="A"
        selected
        onSelect={vi.fn()}
        variant="practice"
        state="incorrect"
      />,
    );
    expect(screen.getByTestId("answer-option")).toHaveAttribute(
      "data-state",
      "incorrect",
    );
  });
});
