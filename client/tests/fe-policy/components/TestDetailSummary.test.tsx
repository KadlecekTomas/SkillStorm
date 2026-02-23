/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestDetailSummary } from "@/components/tests/test-detail-summary";

describe("TestDetailSummary", () => {
  it("displays score, submittedAt and attemptNo", () => {
    render(
      <TestDetailSummary
        testTitle="Test z matematiky"
        score={0.78}
        submittedAt="2025-02-01T12:00:00Z"
        attemptNo={2}
      />
    );

    expect(screen.getByText("Test z matematiky")).toBeInTheDocument();
    expect(screen.getByText("78 %")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows — for null score and submittedAt", () => {
    render(
      <TestDetailSummary
        testTitle="Nevyhodnocený test"
        score={null}
        submittedAt={null}
        attemptNo={1}
      />
    );

    expect(screen.getByText("Nevyhodnocený test")).toBeInTheDocument();
    const labels = screen.getAllByText("—");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows subject badge when subjectName is provided", () => {
    render(
      <TestDetailSummary
        testTitle="ČJ test"
        subjectName="Český jazyk"
        score={0.9}
        submittedAt={null}
        attemptNo={1}
      />
    );

    expect(screen.getByText("Český jazyk")).toBeInTheDocument();
  });
});
