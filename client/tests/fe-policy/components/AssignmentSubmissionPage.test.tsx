/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";
import AssignmentSubmissionPage from "@/app/(school)/app/assignments/[assignmentId]/page";
import { fetchWithAuth } from "@/lib/http/client";
import { recordPolicyCheck } from "../fePolicyScore";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetchWithAuth
vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn(),
}));

// Mock withGuard to return component directly
vi.mock("@/lib/guard/withGuard", () => ({
  withGuard: () => (Component: React.ComponentType) => Component,
}));

describe("AssignmentSubmissionPage", () => {
  it("renders loading state when assignment is being fetched", async () => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({
      assignmentId: "test-assignment-1",
    });

    (fetchWithAuth as ReturnType<typeof vi.fn>).mockImplementation(
      async (method: string, path: string) => {
        // Simulate slow response
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (path.includes("/assignments/")) {
          return {
            id: "test-assignment-1",
            testId: "test-1",
            openAt: new Date().toISOString(),
            closeAt: new Date(Date.now() + 86400000).toISOString(),
            maxAttempts: 3,
          };
        }
        if (path.includes("/tests/")) {
          return {
            id: "test-1",
            title: "Test Assignment",
            questions: [],
          };
        }
        return null;
      },
    );

    render(<AssignmentSubmissionPage />);

    // Should show loading spinner initially
    expect(screen.getByText(/Načítám zadání/i)).toBeInTheDocument();

    recordPolicyCheck(
      "Submissions",
      "submission-page-loading-state",
      true,
      "Submission page shows loading state while fetching assignment.",
    );
  });

  it("renders error state when assignment is not found", async () => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({
      assignmentId: "invalid-assignment",
    });

    (fetchWithAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Assignment not found"),
    );

    render(<AssignmentSubmissionPage />);

    // The page is now a launcher into Focus Test Mode; on a failed assignment fetch it
    // surfaces a graceful error instead of the test form.
    await waitFor(() => {
      expect(
        screen.getByText(/nepodařilo se načíst zadání/i),
      ).toBeInTheDocument();
    });

    recordPolicyCheck(
      "Submissions",
      "submission-page-error-handling",
      true,
      "Submission launcher handles missing assignment gracefully.",
    );
  });
});
