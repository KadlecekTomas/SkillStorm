/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTeachers } from "@/hooks/use-teachers";
import { usePlatformOrganizations } from "@/hooks/use-platform-organizations";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1" },
  }),
}));

vi.mock("@/lib/query-client", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/http/client", async () => {
  const actual = await vi.importActual("@/lib/http/client");
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  };
});

describe("render loop prevention hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the empty teachers fallback stable across rerenders", () => {
    const refetch = vi.fn(async () => true);

    vi.mocked(useQuery).mockImplementation(
      () =>
        ({
          data: undefined,
          isLoading: true,
          error: null,
          refetch,
        }) as unknown as ReturnType<typeof useQuery>,
    );

    const { result, rerender } = renderHook(() => useTeachers());
    const firstTeachers = result.current.teachers;

    rerender();

    expect(result.current.teachers).toBe(firstTeachers);
  });

  it("does not refetch platform organizations when equivalent query contents rerender", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, pages: 1 },
    } as never);

    const { rerender } = renderHook(() =>
      usePlatformOrganizations({
        query: { q: "alpha" },
      }),
    );

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    });

    rerender();

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    });
  });
});
