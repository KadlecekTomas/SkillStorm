/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestTimeline } from "@/components/tests/test-timeline";

describe("TestTimeline", () => {
  it("renders timeline items with date, test title and score", () => {
    const items = [
      {
        submissionId: "s1",
        assignmentId: "a1",
        testTitle: "První test",
        submittedAt: "2025-01-15T10:00:00Z",
        score: 0.9,
        status: "APPROVED",
        attemptNo: 1,
      },
    ];

    render(<TestTimeline items={items} />);

    expect(screen.getByText("První test")).toBeInTheDocument();
    expect(screen.getByText("90 %")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<TestTimeline items={[]} />);

    expect(
      screen.getByText("Zatím žádná odevzdání v tomto období.")
    ).toBeInTheDocument();
  });

  it("renders multiple rows in table", () => {
    const items = [
      {
        submissionId: "s1",
        assignmentId: "a1",
        testTitle: "Test A",
        submittedAt: "2025-01-01T00:00:00Z",
        score: 0.7,
        status: "APPROVED",
        attemptNo: 1,
      },
      {
        submissionId: "s2",
        assignmentId: "a2",
        testTitle: "Test B",
        submittedAt: "2025-01-02T00:00:00Z",
        score: 0.85,
        status: "APPROVED",
        attemptNo: 1,
      },
    ];

    render(<TestTimeline items={items} />);

    expect(screen.getByText("Test A")).toBeInTheDocument();
    expect(screen.getByText("Test B")).toBeInTheDocument();
    expect(screen.getByText("70 %")).toBeInTheDocument();
    expect(screen.getByText("85 %")).toBeInTheDocument();
  });
});
