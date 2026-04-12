"use client";

import { useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";
import {
  buildListQueryKey,
  buildListRequestParams,
  normalizeListFilters,
} from "@/lib/list-query";
import { normalizeAllowedGrades } from "@/lib/grades";
import type { TestSummary } from "@/types";

export type TestListItem = TestSummary & { creator?: { user?: { name?: string | null } } };

type UseTestsListParams = {
  enabled?: boolean;
  organizationId?: string | null;
  academicYearId?: string | null;
  subjectId?: string | null;
  grade?: string | null;
  status?: string | null;
  search?: string | null;
};

const EMPTY_TESTS: TestListItem[] = [];

export function useTestsList(params: UseTestsListParams) {
  const normalizedFilters = useMemo(
    () =>
      normalizeListFilters({
        organizationId: params.organizationId ?? null,
        academicYearId: params.academicYearId ?? null,
        subjectId: params.subjectId ?? null,
        grade: params.grade ?? null,
        status: params.status ?? null,
        search: params.search ?? null,
      }),
    [
      params.academicYearId,
      params.grade,
      params.organizationId,
      params.search,
      params.status,
      params.subjectId,
    ],
  );

  const query = useQuery<{ items?: TestListItem[] } | TestListItem[]>({
    queryKey: buildListQueryKey("tests", normalizedFilters),
    enabled: params.enabled ?? true,
    staleTime: 10_000,
    queryFn: async () => {
      const data = await fetchWithAuth<{ items?: TestListItem[] } | TestListItem[]>("GET", "/tests", {
        query: buildListRequestParams(normalizedFilters),
      });
      return data;
    },
  });

  return useMemo(() => {
    const list =
      query.data && typeof query.data === "object" && "items" in query.data
        ? query.data.items ?? []
        : Array.isArray(query.data)
          ? query.data
          : [];

    return {
      tests: (Array.isArray(list) ? list : EMPTY_TESTS).map((item) => ({
        ...item,
        allowedGrades: normalizeAllowedGrades(item.allowedGrades),
      })),
      loading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
      filters: normalizedFilters,
    };
  }, [normalizedFilters, query.data, query.error, query.isLoading, query.refetch]);
}
