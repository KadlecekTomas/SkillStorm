/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import { httpClient } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import { recordPolicyCheck } from "../fePolicyScore";

// Mock recordPolicyCheck to avoid file system issues in tests
vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

vi.mock("@/lib/http/client");
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));
vi.mock("@/hooks/use-gamification", () => ({
  useGamification: () => ({
    summary: null,
  }),
}));
vi.mock("@/lib/guard/withGuard", () => ({
  withGuard: () => (Component: React.ComponentType) => Component,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching tests", async () => {
    const mockGet = vi.fn(() => new Promise(() => {})); // Never resolves
    vi.mocked(httpClient.get).mockImplementation(mockGet);

    render(<DashboardPage />);

    expect(screen.getByText(/loading tests/i)).toBeInTheDocument();
    recordPolicyCheck("Auth", "dashboard-loading-state", true, "Dashboard shows loading state during fetch.");
  });

  it("displays tests when data is loaded", async () => {
    const mockTests: TestSummary[] = [
      {
        id: "1",
        title: "Test 1",
        description: "Description",
        status: "PUBLISHED",
        version: 1,
        completionRate: 80,
        submissions: 10,
        avgScore: 85,
      },
    ];

    vi.mocked(httpClient.get).mockResolvedValue(mockTests);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Test 1")).toBeInTheDocument();
    });

    recordPolicyCheck("Content", "dashboard-data-display", true, "Dashboard displays test data when loaded.");
  });

  it("shows empty state when no tests are returned", async () => {
    vi.mocked(httpClient.get).mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading tests/i)).not.toBeInTheDocument();
    });

    // Should not crash when tests array is empty
    const testCards = screen.queryAllByText(/test \d+/i);
    expect(testCards).toHaveLength(0);
    recordPolicyCheck("Content", "dashboard-empty-state", true, "Dashboard handles empty test array without crashing.");
  });

  it("handles null response from API gracefully", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(null as unknown as TestSummary[]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading tests/i)).not.toBeInTheDocument();
    });

    // Should not crash on null
    const testCards = screen.queryAllByText(/test \d+/i);
    expect(testCards).toHaveLength(0);
    recordPolicyCheck("Content", "dashboard-null-handling", true, "Dashboard handles null API response without crashing.");
  });

  it("handles undefined response from API gracefully", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(undefined as unknown as TestSummary[]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading tests/i)).not.toBeInTheDocument();
    });

    // Should not crash on undefined
    const testCards = screen.queryAllByText(/test \d+/i);
    expect(testCards).toHaveLength(0);
    recordPolicyCheck("Content", "dashboard-undefined-handling", true, "Dashboard handles undefined API response without crashing.");
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(httpClient.get).mockRejectedValue(new Error("Network error"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading tests/i)).not.toBeInTheDocument();
    });

    // Should not crash on error, should show empty state
    const testCards = screen.queryAllByText(/test \d+/i);
    expect(testCards).toHaveLength(0);
    recordPolicyCheck("Content", "dashboard-error-handling", true, "Dashboard handles API errors without crashing.");
  });
});
