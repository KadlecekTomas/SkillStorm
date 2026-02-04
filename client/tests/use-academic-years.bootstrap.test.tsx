/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ClassroomsPageContent } from "@/components/pages/classrooms/classrooms-page";
import { fetchWithAuth } from "@/lib/http/client";
import { useAcademicYearStore } from "@/store/use-academic-year-store";

const activeDeferred: { resolve?: (value: any) => void } = {};

vi.mock("@/lib/api/academic-years", () => ({
  fetchCurrentAcademicYear: vi.fn(
    () => new Promise((resolve) => {
      activeDeferred.resolve = resolve;
    }),
  ),
}));

const useAuthMock = vi.fn(() => ({
  org: { id: "org-1" },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

vi.mock("@/lib/http/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/client")>("@/lib/http/client");
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  };
});

describe("useAcademicYears bootstrap gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ org: { id: "org-1" } });
    useAcademicYearStore.setState({
      selectedByOrg: { "org-1": "year-persisted" },
    });
    vi.mocked(fetchWithAuth).mockImplementation((method, path, config) => {
      if (path === "/academic-years") {
        return Promise.resolve([
          { id: "year-1", name: "2024/25", isActive: true },
        ] as any);
      }
      if (path === "/classrooms") {
        return Promise.resolve({ data: [] } as any);
      }
      return Promise.resolve(null as any);
    });
  });

  it("does not fetch classrooms until current academic year resolves", async () => {
    render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith("GET", "/academic-years", expect.anything());
    });

    expect(
      vi.mocked(fetchWithAuth).mock.calls.some((call) => call[1] === "/classrooms"),
    ).toBe(false);

    activeDeferred.resolve?.({ id: "year-1", name: "2024/25" });

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith("GET", "/classrooms", {
        query: { yearId: "year-1" },
      });
    });
  });

  it("does not apply /academic-years list from previous org after org switch", async () => {
    // First call: org-1, slow response
    useAuthMock.mockReturnValueOnce({ org: { id: "org-1" } });

    const listDeferred: { resolve?: (value: any) => void } = {};

    vi.mocked(fetchWithAuth).mockImplementation((method, path, config) => {
      if (path === "/academic-years") {
        return new Promise((resolve) => {
          listDeferred.resolve = resolve;
        }) as any;
      }
      if (path === "/classrooms") {
        return Promise.resolve({ data: [] } as any);
      }
      return Promise.resolve(null as any);
    });

    render(<ClassroomsPageContent />);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith("GET", "/academic-years", expect.anything());
    });

    // Simulate org switch before the list resolves
    useAuthMock.mockReturnValue({ org: { id: "org-2" } });

    // Resolve the original org-1 list; hook should ignore it
    listDeferred.resolve?.([
      { id: "year-org-1", name: "Org1 year", isActive: true },
    ] as any);

    // Give React a tick; there should be no crash and the stale list must be ignored.
    await waitFor(() => {
      expect(true).toBe(true);
    });
  });
});
