/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TestsPage from "@/app/(dashboard)/dashboard/tests/page";
import { fetchWithAuth } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import { recordPolicyCheck } from "../fePolicyScore";

// Mock recordPolicyCheck to avoid file system issues in tests
vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

vi.mock("@/lib/http/client");
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1" },
    context: { mode: "organization" },
    user: { organizationRole: "TEACHER" },
  }),
}));
vi.mock("@/hooks/use-academic-years", () => ({
  useAcademicYears: () => ({ selectedYearId: "year-1" }),
}));
vi.mock("@/hooks/use-test-assignments", () => ({
  useTestAssignments: () => ({ byTestId: {} }),
}));
vi.mock("@/lib/guard/withGuard", () => ({
  withGuard: () => (Component: React.ComponentType) => Component,
}));

describe("TestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching tests", async () => {
    const mockFetch = vi.fn(() => new Promise(() => {})); // Never resolves
    vi.mocked(fetchWithAuth).mockImplementation(mockFetch);

    render(<TestsPage />);

    expect(screen.getByText(/načítám testy/i)).toBeInTheDocument();
    recordPolicyCheck("Content", "tests-page-loading-state", true, "Tests page shows loading state during fetch.");
  });

  it("displays tests when data is loaded", async () => {
    const mockTests: TestSummary[] = [
      {
        id: "1",
        title: "Math Test",
        description: "Test description",
        status: "PUBLISHED",
        version: 1,
        completionRate: 75,
        submissions: 20,
        avgScore: 82,
      },
    ];

    vi.mocked(fetchWithAuth).mockResolvedValue(mockTests);

    render(<TestsPage />);

    await waitFor(() => {
      // Check that test appears in the data table (more specific than just text)
      const testTitles = screen.getAllByText("Math Test");
      expect(testTitles.length).toBeGreaterThan(0);
    });

    recordPolicyCheck("Content", "tests-page-data-display", true, "Tests page displays test data when loaded.");
  });

  it("shows empty state when no tests are returned", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue([]);

    render(<TestsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/načítám testy/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/zatím nemáš žádné testy/i)).toBeInTheDocument();
    recordPolicyCheck("Content", "tests-page-empty-state", true, "Tests page shows empty state when no tests.");
  });

  it("handles null response from API gracefully", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(null as unknown as TestSummary[]);

    render(<TestsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/načítám testy/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/zatím nemáš žádné testy/i)).toBeInTheDocument();
    recordPolicyCheck("Content", "tests-page-null-handling", true, "Tests page handles null API response with fallback.");
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error("API error"));

    render(<TestsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/načítám testy/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/zatím nemáš žádné testy/i)).toBeInTheDocument();
    recordPolicyCheck("Content", "tests-page-error-handling", true, "Tests page handles API errors without crashing.");
  });

  it("does not show loading spinner and data table simultaneously", async () => {
    const mockTests: TestSummary[] = [
      {
        id: "1",
        title: "Test",
        status: "PUBLISHED",
        version: 1,
        completionRate: 50,
        submissions: 5,
        avgScore: 70,
      },
    ];

    vi.mocked(fetchWithAuth).mockResolvedValue(mockTests);

    render(<TestsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/načítám testy/i)).not.toBeInTheDocument();
    });

    const loadingSpinners = screen.queryAllByText(/načítám testy/i);
    expect(loadingSpinners).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /moje testy/i })).toBeInTheDocument();
    recordPolicyCheck("Content", "tests-page-loading-consistency", true, "Tests page does not show loading and data simultaneously.");
  });
});
