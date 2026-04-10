/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";
import { fetchWithAuth } from "@/lib/http/client";
import { showToastOnce } from "@/utils/toast";
import { recordPolicyCheck } from "../fePolicyScore";

const {
  replaceMock,
  syncProfileMock,
  searchParamsState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  syncProfileMock: vi.fn(),
  searchParamsState: { current: new URLSearchParams() },
}));

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => searchParamsState.current,
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
  isAcademicYearExpired: false,
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
    syncProfile: syncProfileMock,
    isLoading: false,
    isAuthenticated: true,
    roles: ["DIRECTOR"],
  }),
}));

vi.mock("@/hooks/use-teachers", () => ({
  useTeachers: () => ({
    teachers: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/use-classroom-detail", () => ({
  useClassroomDetail: () => ({
    detail: null,
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-classroom-risk-overview", () => ({
  useClassroomRiskOverview: () => ({
    data: null,
    loading: false,
  }),
}));

vi.mock("@/hooks/use-classroom-subject-performance", () => ({
  useClassroomSubjectPerformance: () => ({
    data: null,
    loading: false,
  }),
}));

vi.mock("@/hooks/use-classroom-structure", () => ({
  useClassroomStructure: () => ({
    data: null,
    loading: false,
  }),
}));

vi.mock("@/hooks/use-class-section-org-subjects", () => ({
  useClassSectionOrgSubjects: () => ({
    subjects: [],
    loading: false,
    saving: false,
    error: null,
    attach: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-org-subjects", () => ({
  useOrgSubjects: () => ({
    subjects: [],
    loading: false,
  }),
  subjectLabel: () => "",
}));

vi.mock("@/hooks/use-available-students", () => ({
  useAvailableStudents: () => ({
    students: [],
    loading: false,
  }),
}));

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status = 500, data: unknown = undefined) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
}));

vi.mock("@/utils/toast", () => ({
  showToastOnce: vi.fn(),
}));

describe("ClassroomsPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.current = new URLSearchParams();
    academicYearsState.status = "ready";
    academicYearsState.selectedYear = { id: "year-1", name: "2024/25", isActive: true };
    academicYearsState.selectedYearId = "year-1";
    academicYearsState.activeYear = { id: "year-1", name: "2024/25", isActive: true };
    academicYearsState.isReadOnly = false;
    academicYearsState.yearConfigError = null;
    academicYearsState.isAcademicYearExpired = false;
    syncProfileMock.mockResolvedValue(undefined);
  });

  it("shows empty state when no classrooms exist", async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (method, url) => {
      if (method === "GET" && url === "/classrooms") return { data: [] };
      return [];
    });

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

    vi.mocked(fetchWithAuth).mockImplementation(async (method, url) => {
      if (method === "GET" && url === "/classrooms") {
        return {
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
        };
      }
      return [];
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

  it("reloads classrooms with selected year in the actual request", async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (method, url) => {
      if (method === "GET" && url === "/classrooms") return { data: [] };
      return [];
    });

    const { rerender } = render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ limit: 20, yearId: "year-1" }),
        }),
      );
    });

    academicYearsState.selectedYear = { id: "year-2", name: "2023/24", isActive: false };
    academicYearsState.selectedYearId = "year-2";
    academicYearsState.isReadOnly = true;

    rerender(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenLastCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ limit: 20, yearId: "year-2" }),
        }),
      );
    });

    recordPolicyCheck(
      "UX",
      "classrooms-year-switch",
      true,
      "Changing academic year reloads classrooms for the selected year.",
    );
  });

  it("shows explicit feedback when created classroom is hidden by active filters", async () => {
    searchParamsState.current = new URLSearchParams("teacher=teacher-1");

    vi.mocked(fetchWithAuth).mockImplementation(async (method, url) => {
      if (method === "GET" && url === "/classrooms") {
        return { data: [] };
      }
      if (method === "POST" && url === "/classrooms") {
        return {
          id: "class-new",
          yearId: "year-1",
          grade: "GRADE_5",
          section: "B",
          label: "5.B",
        };
      }
      return [];
    });

    render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ yearId: "year-1", teacherId: "teacher-1" }),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("create-classroom-btn"));
    fireEvent.change(screen.getByPlaceholderText("A"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^vytvořit$/i }));

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "POST",
        "/classrooms",
        expect.objectContaining({
          body: expect.objectContaining({
            yearId: "year-1",
            grade: "GRADE_5",
            section: "B",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(syncProfileMock).toHaveBeenCalledWith({ force: true });
    });

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledTimes(3);
    });

    expect(showToastOnce).toHaveBeenCalledWith(
      "Třída byla vytvořena, ale aktuální filtry ji skrývají.",
      expect.objectContaining({ type: "info" }),
    );
    expect(showToastOnce).toHaveBeenCalledWith(
      "Třída vytvořena",
      expect.objectContaining({ type: "success" }),
    );
    expect(replaceMock).not.toHaveBeenCalledWith(expect.stringContaining("highlight=class-new"));
  });
});
