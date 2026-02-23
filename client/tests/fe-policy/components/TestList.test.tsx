/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestList } from "@/components/tests/test-list";

describe("TestList", () => {
  it("renders items with title, status and score", () => {
    const items = [
      {
        assignmentId: "a1",
        testId: "t1",
        testTitle: "Matematika – čísla",
        subjectName: null,
        status: "done" as const,
        lastScore: 0.85,
      },
      {
        assignmentId: "a2",
        testId: "t2",
        testTitle: "Český jazyk – pravopis",
        subjectName: "ČJ",
        status: "open" as const,
        lastScore: null,
      },
    ];
    render(<TestList items={items} onOpenTest={vi.fn()} onViewResult={vi.fn()} />);

    expect(screen.getByText("Matematika – čísla")).toBeInTheDocument();
    expect(screen.getByText("Český jazyk – pravopis")).toBeInTheDocument();
    expect(screen.getByText("Splněno")).toBeInTheDocument();
    expect(screen.getByText("85 %")).toBeInTheDocument();
    expect(screen.getByText("Otevřeno")).toBeInTheDocument();
    expect(screen.getByText("ČJ")).toBeInTheDocument();
  });

  it("shows empty message when no items", () => {
    render(<TestList items={[]} />);
    expect(screen.getByText("Žádná zadání k zobrazení.")).toBeInTheDocument();
  });

  it("calls onOpenTest when Otevřít test is clicked", () => {
    const onOpenTest = vi.fn();
    render(
      <TestList
        items={[
          {
            assignmentId: "a1",
            testTitle: "Test",
            status: "open",
            lastScore: null,
          },
        ]}
        onOpenTest={onOpenTest}
      />
    );
    screen.getByRole("button", { name: /otevřít test/i }).click();
    expect(onOpenTest).toHaveBeenCalledWith("a1");
  });

  it("calls onViewResult when Zobrazit výsledek is clicked", () => {
    const onViewResult = vi.fn();
    render(
      <TestList
        items={[
          {
            assignmentId: "a1",
            testTitle: "Test",
            status: "done",
            lastScore: 0.9,
          },
        ]}
        onViewResult={onViewResult}
      />
    );
    screen.getByRole("button", { name: /zobrazit výsledek/i }).click();
    expect(onViewResult).toHaveBeenCalledWith("a1");
  });
});
