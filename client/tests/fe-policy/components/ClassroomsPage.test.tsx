/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { queryClient } from "@/lib/query-client";
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
    replace: (target: string) => {
      replaceMock(target);
      const query = target.split("?")[1] ?? "";
      searchParamsState.current = new URLSearchParams(query);
    },
    push: (target: string) => {
      const query = target.split("?")[1] ?? "";
      searchParamsState.current = new URLSearchParams(query);
    },
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

vi.mock("@/components/modals/base-modal", () => ({
  BaseModal: ({
    open,
    title,
    description,
    children,
  }: {
    open: boolean;
    title: string;
    description?: string;
    children: ReactNode;
  }) =>
    open ? (
      <div data-testid={`modal-${title}`}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/select", () => {
  const Select = ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  );

  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => <option value={value}>{children}</option>;

  const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>;

  return {
    Select,
    SelectContent: passthrough,
    SelectItem,
    SelectTrigger: passthrough,
    SelectValue: () => null,
  };
});

vi.mock("@/components/support/report-issue-button", () => ({
  ReportIssueButton: () => <button type="button">Report issue</button>,
}));

describe("ClassroomsPageContent", () => {
  const renderPage = async () => {
    const { ClassroomsPageContent } = await import("@/components/pages/classrooms/classrooms-page");
    return render(<ClassroomsPageContent />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
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

    await renderPage();

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

    await renderPage();

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

  const { rerender } = await renderPage();

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "GET",
        "/classrooms",
        expect.objectContaining({
          query: expect.objectContaining({ limit: 20, yearId: "year-1" }),
        }),
      );
    });

    searchParamsState.current = new URLSearchParams("year=year-2");
    academicYearsState.selectedYear = { id: "year-2", name: "2023/24", isActive: false };
    academicYearsState.selectedYearId = "year-2";
    academicYearsState.activeYear = { id: "year-1", name: "2024/25", isActive: true };

    const { ClassroomsPageContent } = await import("@/components/pages/classrooms/classrooms-page");
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

  it("normalizes stale cursor pages before showing an empty-state message", async () => {
    searchParamsState.current = new URLSearchParams("year=year-1&limit=20&cursor=stale-cursor&dir=next");

    vi.mocked(fetchWithAuth).mockImplementation(async (method, url, config) => {
      if (method === "GET" && url === "/classrooms") {
        if (config?.query?.cursor === "stale-cursor") {
          return {
            data: [],
            meta: {
              limit: 20,
              hasNextPage: false,
              hasPrevPage: true,
              nextCursor: null,
              prevCursor: "prev-cursor",
            },
          };
        }

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
          meta: {
            limit: 20,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
          },
        };
      }
      return [];
    });

    const { rerender } = await renderPage();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/app/classrooms?year=year-1&limit=20");
    });

    expect(screen.getByText(/vracíme se na začátek seznamu/i)).toBeInTheDocument();
    expect(screen.queryByText(/zatím.*žádné třídy/i)).not.toBeInTheDocument();

    const { ClassroomsPageContent } = await import("@/components/pages/classrooms/classrooms-page");
    rerender(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(screen.getByText("5.A")).toBeInTheDocument();
    });
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

    await renderPage();

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
  });

  it("renders fallback text and keeps valid rows visible when classrooms API returns malformed row fields", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(fetchWithAuth).mockImplementation(async (method, url) => {
      if (method === "GET" && url === "/classrooms") {
        return {
          data: [
            {
              id: "class-bad",
              grade: "GRADE_5",
              section: "A",
              label: { unexpected: true },
              teacher: {
                membership: {
                  user: {
                    name: { broken: true },
                  },
                },
              },
              students: { invalid: true },
              enrollments: { invalid: true },
            },
            {
              id: "class-good",
              grade: "GRADE_6",
              section: "B",
              label: "6.B",
              teacher: { membership: { user: { name: "Učitel B" } } },
              enrollments: [],
              studentCount: 3,
            },
          ],
        };
      }
      return [];
    });

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("5.A")).toBeInTheDocument();
      expect(screen.getByText("6.B")).toBeInTheDocument();
      expect(screen.getByText("Učitel B")).toBeInTheDocument();
    });

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
