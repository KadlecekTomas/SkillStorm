/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";
import { fetchWithAuth } from "@/lib/http/client";
import { recordPolicyCheck } from "../fePolicyScore";

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

const academicYearsState = {
  years: [
    { id: "year-1", name: "2024/25", isActive: true },
    { id: "year-2", name: "2023/24", isActive: false },
  ],
  status: "ready" as const,
  selectedYear: { id: "year-1", name: "2024/25", isActive: true },
  selectedYearId: "year-1",
  activeYear: { id: "year-1", name: "2024/25", isActive: true },
  isReadOnly: false,
  bootstrapState: "READY",
  loading: false,
  error: null,
  yearConfigError: null,
  refresh: vi.fn(),
  setSelectedYearId: vi.fn(),
  setSelectedYear: vi.fn(),
};

vi.mock("@/hooks/use-academic-years", () => ({
  useAcademicYears: () => academicYearsState,
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1", status: "ACTIVE", readiness: "READY", bootstrap: null },
    syncProfile: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
    roles: ["TEACHER"],
  }),
}));

vi.mock("@/hooks/use-teachers", () => ({
  useTeachers: () => ({
    teachers: [],
    loading: false,
  }),
}));

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("ClassroomsPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    academicYearsState.status = "ready";
    academicYearsState.selectedYear = { id: "year-1", name: "2024/25", isActive: true };
    academicYearsState.selectedYearId = "year-1";
    academicYearsState.isReadOnly = false;
  });

  it("shows empty state when no classrooms exist", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({ data: [] });

    render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(screen.getByText(/zatím.*žádné třídy/i)).toBeInTheDocument();
    });
    recordPolicyCheck(
      "UX",
      "classrooms-empty-state",
      true,
      "Classrooms empty state is shown when no classes exist.",
    );
  });

  it("marks past years as read-only", async () => {
    academicYearsState.selectedYear = { id: "year-2", name: "2023/24", isActive: false };
    academicYearsState.selectedYearId = "year-2";
    academicYearsState.isReadOnly = true;

    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce({
        data: [
          {
            id: "class-1",
            grade: "GRADE_5",
            section: "A",
            label: "5.A",
            enrollments: [],
            teacher: { membership: { user: { name: "Učitel A" } } },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "class-1",
        grade: "GRADE_5",
        section: "A",
        label: "5.A",
        enrollments: [],
      });

    render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(screen.getByText(/^read-only$/i)).toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", { name: /vytvořit třídu/i });
    expect(createButton).toBeDisabled();
    recordPolicyCheck(
      "UX",
      "classrooms-read-only",
      true,
      "Read-only badge and disabled actions appear for past academic years.",
    );
  });

  it("reloads classrooms when academic year changes", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({ data: [] });

    const { rerender } = render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ yearId: "year-1" }),
        }),
      );
    });

    academicYearsState.selectedYear = { id: "year-2", name: "2023/24", isActive: false };
    academicYearsState.selectedYearId = "year-2";
    academicYearsState.isReadOnly = true;

    vi.mocked(fetchWithAuth).mockResolvedValueOnce({ data: [] });

    rerender(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ yearId: "year-2" }),
        }),
      );
    });

    recordPolicyCheck(
      "UX",
      "classrooms-year-switch",
      true,
      "Changing academic year triggers a data reload for classrooms.",
    );
  });
});
