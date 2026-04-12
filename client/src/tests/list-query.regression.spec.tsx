/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTeachers } from "@/hooks/use-teachers";
import { useStudentsList } from "@/hooks/use-students-list";
import { buildListRequestParams, buildListQueryKey, normalizeListFilters } from "@/lib/list-query";
import { queryClient } from "@/lib/query-client";
import { fetchWithAuth, httpClient } from "@/lib/http/client";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1" },
  }),
}));

vi.mock("@/lib/http/client", async () => {
  const actual = await vi.importActual("@/lib/http/client");
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    httpClient: {
      get: vi.fn(),
    },
  };
});

describe("shared list-query architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("normalizes empty filter values and omits them from request params", () => {
    const normalized = normalizeListFilters({
      search: "   ",
      grade: "ALL",
      yearId: "year-1",
      page: 1,
    });

    expect(normalized).toEqual({
      search: null,
      grade: null,
      yearId: "year-1",
      page: 1,
    });
    expect(buildListRequestParams(normalized)).toEqual({
      yearId: "year-1",
      page: 1,
    });
    expect(buildListQueryKey("students", { search: "", yearId: "year-1" })).toEqual(
      buildListQueryKey("students", { search: "   ", yearId: "year-1" }),
    );
  });

  it("teachers list keeps canonical results across filter and clear transitions", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (_url, config) => {
      const search = typeof config?.query?.search === "string" ? config.query.search : undefined;
      if (search === "Alice") {
        return {
          items: [{ id: "teacher-1", membership: { user: { name: "Alice" } } }],
          meta: { page: 1, limit: 50, total: 1, pages: 1 },
        };
      }
      return {
        items: [
          { id: "teacher-1", membership: { user: { name: "Alice" } } },
          { id: "teacher-2", membership: { user: { name: "Bob" } } },
        ],
        meta: { page: 1, limit: 50, total: 2, pages: 1 },
      };
    });

    const { result, rerender } = renderHook(
      ({ search }) => useTeachers({ query: { search } }),
      { initialProps: { search: null as string | null } },
    );

    await waitFor(() => {
      expect(result.current.total).toBe(2);
      expect(result.current.teachers).toHaveLength(2);
    });

    rerender({ search: "Alice" });

    await waitFor(() => {
      expect(result.current.total).toBe(1);
      expect(result.current.teachers[0]?.membership?.user?.name).toBe("Alice");
    });

    rerender({ search: "   " });

    await waitFor(() => {
      expect(result.current.total).toBe(2);
      expect(result.current.teachers).toHaveLength(2);
    });

    const teacherCalls = vi.mocked(httpClient.get).mock.calls
      .map(([, config]) => config as { query?: Record<string, unknown> } | undefined)
      .filter((config) => (config?.query?.organizationId as string | undefined) === "org-1");
    expect(teacherCalls.some((config) =>
      config?.query?.page === 1 &&
      config?.query?.limit === 50 &&
      !Object.prototype.hasOwnProperty.call(config.query ?? {}, "search"),
    )).toBe(true);
  });

  it("students list keeps canonical results across filter and clear transitions", async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async (_method, _url, config) => {
      const search = typeof config?.query?.search === "string" ? config.query.search : undefined;
      if (search === "Anna") {
        return {
          data: [{ id: "student-1", membership: { user: { name: "Anna" } } }],
          meta: { page: 1, limit: 20, total: 1, pages: 1 },
        };
      }
      return {
        data: [
          { id: "student-1", membership: { user: { name: "Anna" } } },
          { id: "student-2", membership: { user: { name: "Boris" } } },
        ],
        meta: { page: 1, limit: 20, total: 2, pages: 1 },
      };
    });

    const { result, rerender } = renderHook(
      ({ search }) =>
        useStudentsList({
          enabled: true,
          query: { yearId: "year-1", search },
        }),
      { initialProps: { search: null as string | null } },
    );

    await waitFor(() => {
      expect(result.current.students).toHaveLength(2);
      expect(result.current.meta?.total).toBe(2);
    });

    rerender({ search: "Anna" });

    await waitFor(() => {
      expect(result.current.students).toHaveLength(1);
      expect(result.current.students[0]?.membership?.user?.name).toBe("Anna");
    });

    rerender({ search: "" });

    await waitFor(() => {
      expect(result.current.students).toHaveLength(2);
      expect(result.current.meta?.total).toBe(2);
    });

    const studentCalls = vi.mocked(fetchWithAuth).mock.calls
      .filter(([, url]) => url === "/students")
      .map(([, , config]) => config as { query?: Record<string, unknown> } | undefined);
    expect(studentCalls.some((config) =>
      config?.query?.yearId === "year-1" &&
      config?.query?.page === 1 &&
      config?.query?.limit === 20 &&
      !Object.prototype.hasOwnProperty.call(config.query ?? {}, "search"),
    )).toBe(true);
  });
});
