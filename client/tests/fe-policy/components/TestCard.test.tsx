/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestCard } from "@/components/cards/test-card";
import type { TestSummary } from "@/types";
import { createMockSubject } from "@/utils/sample-data";
import { recordPolicyCheck } from "../fePolicyScore";

// Mock recordPolicyCheck to avoid file system issues in tests
vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("TestCard", () => {
  const mockTest: TestSummary = {
    id: "1",
    title: "Math Test",
    description: "Test description",
    subject: createMockSubject({ id: "subj-1", name: "Mathematics" }),
    status: "PUBLISHED",
    version: 1,
    completionRate: 80,
    submissions: 10,
    avgScore: 85,
  };

  it("renders test data correctly", () => {
    render(<TestCard test={mockTest} />);

    expect(screen.getByText("Math Test")).toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText(/80%/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    recordPolicyCheck("Content", "test-card-rendering", true, "TestCard renders test data correctly.");
  });

  it("shows '—' for all metrics when values are null (no submissions yet)", () => {
    const noDataTest: TestSummary = {
      ...mockTest,
      completionRate: null,
      avgScore: null,
      submissions: null,
    };
    render(<TestCard test={noDataTest} />);

    // All three metric slots must render "—", never "NaN%" or "undefined%"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();

    recordPolicyCheck(
      "Content",
      "test-card-null-metrics",
      true,
      "TestCard shows '—' for all metrics when values are null.",
    );
  });

  it("never renders NaN% when metrics are undefined (API gap)", () => {
    // Simulate the old API response shape that omitted these fields entirely
    const legacyTest = {
      ...mockTest,
      completionRate: undefined as unknown as null,
      avgScore: undefined as unknown as null,
      submissions: undefined as unknown as null,
    };
    render(<TestCard test={legacyTest} />);

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();

    recordPolicyCheck(
      "Content",
      "test-card-undefined-metrics",
      true,
      "TestCard never renders NaN% or undefined% when metric fields are missing.",
    );
  });

  it("handles missing subject gracefully", () => {
    const testWithoutSubject = { ...mockTest, subject: null };
    render(<TestCard test={testWithoutSubject} />);

    expect(screen.getByText("General subject")).toBeInTheDocument();
    recordPolicyCheck("Content", "test-card-null-subject", true, "TestCard handles null subject with fallback.");
  });

  it("handles missing description gracefully", () => {
    const testWithoutDescription = { ...mockTest, description: null };
    render(<TestCard test={testWithoutDescription} />);

    // Should not crash
    expect(screen.getByText("Math Test")).toBeInTheDocument();
    recordPolicyCheck("Content", "test-card-null-description", true, "TestCard handles null description without crashing.");
  });

  it("renders status badge correctly", () => {
    render(<TestCard test={mockTest} />);

    expect(screen.getByText(/publikováno/i)).toBeInTheDocument();
    recordPolicyCheck("Content", "test-card-status-badge", true, "TestCard renders status badge correctly.");
  });

  it("calls onView callback when provided", () => {
    const onView = vi.fn();
    render(<TestCard test={mockTest} onView={onView} />);

    const detailsButton = screen.getByRole("button", { name: /detail/i });
    detailsButton.click();

    expect(onView).toHaveBeenCalledWith("1");
    recordPolicyCheck("Content", "test-card-onView-callback", true, "TestCard calls onView callback with test ID.");
  });
});
