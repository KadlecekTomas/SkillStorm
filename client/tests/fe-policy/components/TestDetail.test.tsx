/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TestDetail } from "@/components/tests/test-detail";
import { recordPolicyCheck } from "../fePolicyScore";

const questions = [
  {
    id: "single",
    type: "single" as const,
    prompt: "Select option",
    options: ["A", "B"],
  },
  {
    id: "numeric",
    type: "numeric" as const,
    prompt: "Numeric answer",
  },
  {
    id: "text",
    type: "text" as const,
    prompt: "Explain",
  },
];

describe("TestDetail", () => {
  it("validates required answers and emits payload", () => {
    const onSubmit = vi.fn();
    render(
      <TestDetail
        title="Policy test"
        description="Validation check"
        questions={questions}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /odeslat/i }));
    expect(screen.getAllByText(/Vyžadována odpověď/i).length).toBe(3);

    fireEvent.click(screen.getByLabelText("A"));
    fireEvent.change(screen.getByPlaceholderText(/zadej číslo/i), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByPlaceholderText(/tvoje odpověď/i), {
      target: { value: "text" },
    });

    fireEvent.click(screen.getByRole("button", { name: /odeslat/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      single: "A",
      numeric: "5",
      text: "text",
    });

    recordPolicyCheck("Content", "test-detail-validation", true, "Test detail enforces validation on policy questions.");
  });
});
