/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { CurrentAcademicYearBoundary } from "@/components/academic-years/CurrentAcademicYearBoundary";
import { CurrentAcademicYearRequiredScreen } from "@/components/academic-years/CurrentAcademicYearRequiredScreen";
import { fetchCurrentAcademicYear } from "@/lib/api/academic-years";
import { httpClient, HttpError } from "@/lib/http/client";
import { useCurrentAcademicYearState } from "@/store/use-current-academic-year-state";
import { showToastOnce } from "@/utils/toast";

const {
  replaceMock,
  refreshMock,
  syncProfileMock,
  pathnameState,
  authState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  syncProfileMock: vi.fn(),
  pathnameState: { current: "/dashboard/tests" },
  authState: {
    org: { id: "org-1", type: "SCHOOL" as const },
    orgState: "ACTIVE",
    context: { mode: "organization" as const },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
  usePathname: () => pathnameState.current,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: authState.org,
    orgState: authState.orgState,
    context: authState.context,
    syncProfile: syncProfileMock,
  }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

vi.mock("@/lib/api/academic-years", () => ({
  fetchCurrentAcademicYear: vi.fn(),
}));

vi.mock("@/lib/http/client", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
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
    title,
    description,
    open,
    children,
  }: {
    title: string;
    description?: string;
    open: boolean;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid={`modal-${title}`}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </div>
    ) : null,
}));

describe("Current academic year required UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathnameState.current = "/dashboard/tests";
    authState.org = { id: "org-1", type: "SCHOOL" };
    authState.orgState = "ACTIVE";
    authState.context = { mode: "organization" };
    syncProfileMock.mockResolvedValue(undefined);
    useCurrentAcademicYearState.getState().clearAll();
  });

  it("does not render children or fire child fetches before verification succeeds", async () => {
    let resolveCurrentYear: (() => void) | null = null;
    const childFetchSpy = vi.fn();
    vi.mocked(fetchCurrentAcademicYear).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCurrentYear = () => resolve({ id: "year-1", name: "2025/2026" });
        }),
    );

    function ProtectedChild() {
      useEffect(() => {
        childFetchSpy();
      }, []);
      return <div>Protected content</div>;
    }

    render(
      <CurrentAcademicYearBoundary>
        <ProtectedChild />
      </CurrentAcademicYearBoundary>,
    );

    expect(screen.getByText("Kontroluji aktuální školní rok…")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(childFetchSpy).not.toHaveBeenCalled();

    resolveCurrentYear?.();

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
    expect(childFetchSpy).toHaveBeenCalledTimes(1);
  });

  it("turns 409 NO_CURRENT_ACADEMIC_YEAR into empty state and blocks normal content", async () => {
    vi.mocked(fetchCurrentAcademicYear).mockRejectedValue(
      new HttpError("No current year", 409, { code: "NO_CURRENT_ACADEMIC_YEAR" }),
    );
    vi.mocked(httpClient.get).mockResolvedValue([]);

    render(
      <CurrentAcademicYearBoundary>
        <div>Normal dashboard content</div>
      </CurrentAcademicYearBoundary>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Škola nemá nastavený aktuální školní rok"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Pro práci s třídami, testy a výsledky je potřeba nastavit aktuální školní rok."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Normal dashboard content")).not.toBeInTheDocument();
  });

  it("revalidates even after stale missing state and unblocks when backend is healthy", async () => {
    useCurrentAcademicYearState.getState().markMissing("org-1", {
      errorCode: "NO_CURRENT_ACADEMIC_YEAR",
      returnPath: "/dashboard/tests",
    });
    vi.mocked(fetchCurrentAcademicYear).mockResolvedValue({ id: "year-1", name: "2025/2026" });

    render(
      <CurrentAcademicYearBoundary>
        <div>Recovered content</div>
      </CurrentAcademicYearBoundary>,
    );

    await waitFor(() => {
      expect(fetchCurrentAcademicYear).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });
    expect(useCurrentAcademicYearState.getState().byOrg["org-1"]?.status).toBe("ok");
  });

  it("recomputes on org switch and does not leak missing state from previous org", async () => {
    vi.mocked(fetchCurrentAcademicYear)
      .mockRejectedValueOnce(new HttpError("No current year", 409, { code: "NO_CURRENT_ACADEMIC_YEAR" }))
      .mockResolvedValueOnce({ id: "year-2", name: "2026/2027" });

    const { rerender } = render(
      <CurrentAcademicYearBoundary>
        <div>Org specific content</div>
      </CurrentAcademicYearBoundary>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Škola nemá nastavený aktuální školní rok"),
      ).toBeInTheDocument();
    });

    authState.org = { id: "org-2", type: "SCHOOL" };
    rerender(
      <CurrentAcademicYearBoundary>
        <div>Org specific content</div>
      </CurrentAcademicYearBoundary>,
    );

    await waitFor(() => {
      expect(fetchCurrentAcademicYear).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText("Org specific content")).toBeInTheDocument();
    });
    expect(useCurrentAcademicYearState.getState().byOrg["org-1"]?.status).toBe("missing");
    expect(useCurrentAcademicYearState.getState().byOrg["org-2"]?.status).toBe("ok");
  });

  it.each(["/tests", "/tests/create"])(
    "protects alias route %s with the missing-year screen",
    async (pathname) => {
      pathnameState.current = pathname;
      vi.mocked(fetchCurrentAcademicYear).mockRejectedValue(
        new HttpError("No current year", 409, { code: "NO_CURRENT_ACADEMIC_YEAR" }),
      );

      render(
        <CurrentAcademicYearBoundary>
          <div>Alias route content</div>
        </CurrentAcademicYearBoundary>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Škola nemá nastavený aktuální školní rok"),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText("Alias route content")).not.toBeInTheDocument();
    },
  );

  it("recovers through create flow and clears the missing-year state", async () => {
    vi.mocked(httpClient.get).mockResolvedValue([]);
    vi.mocked(httpClient.post).mockResolvedValue({ id: "year-1" });
    useCurrentAcademicYearState.getState().markMissing("org-1", {
      errorCode: "NO_CURRENT_ACADEMIC_YEAR",
      returnPath: "/dashboard/tests",
    });

    render(<CurrentAcademicYearRequiredScreen />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Vytvořit školní rok" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Vytvořit školní rok" }));

    await waitFor(() => {
      expect(screen.getByTestId("modal-Vytvořit školní rok")).toBeInTheDocument();
    });

    fireEvent.click(
      within(screen.getByTestId("modal-Vytvořit školní rok")).getByRole("button", {
        name: "Vytvořit školní rok",
      }),
    );

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith("/academic-years", {
        startYear: expect.any(Number),
        isActive: true,
      });
    });
    await waitFor(() => {
      expect(syncProfileMock).toHaveBeenCalledWith({ force: true });
    });
    expect(useCurrentAcademicYearState.getState().byOrg["org-1"]?.status).toBe("ok");
    expect(showToastOnce).toHaveBeenCalledWith("Školní rok byl vytvořen.", { type: "success" });
    expect(replaceMock).toHaveBeenCalledWith("/dashboard/tests");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("recovers through activate flow when years already exist", async () => {
    vi.mocked(httpClient.get).mockResolvedValue([
      {
        id: "year-existing",
        organizationId: "org-1",
        name: "2025/2026",
        startDate: "2025-09-01",
        endDate: "2026-08-31",
        isActive: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(httpClient.request).mockResolvedValue({ ok: true });
    useCurrentAcademicYearState.getState().markMissing("org-1", {
      errorCode: "NO_CURRENT_ACADEMIC_YEAR",
      returnPath: "/dashboard/tests",
    });

    render(<CurrentAcademicYearRequiredScreen />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Vybrat existující rok" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Vybrat existující rok" }));

    await waitFor(() => {
      expect(screen.getByTestId("modal-Vybrat existující rok")).toBeInTheDocument();
    });

    fireEvent.click(
      within(screen.getByTestId("modal-Vybrat existující rok")).getByRole("button", {
        name: "Aktivovat rok",
      }),
    );

    await waitFor(() => {
      expect(httpClient.request).toHaveBeenCalledWith(
        "PATCH",
        "/academic-years/year-existing/activate",
      );
    });
    await waitFor(() => {
      expect(syncProfileMock).toHaveBeenCalledWith({ force: true });
    });
    expect(useCurrentAcademicYearState.getState().byOrg["org-1"]?.status).toBe("ok");
    expect(showToastOnce).toHaveBeenCalledWith("Školní rok byl aktivován.", { type: "success" });
  });
});
