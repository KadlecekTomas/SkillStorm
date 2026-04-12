"use client";

import { useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";
import {
  buildListQueryKey,
  buildListRequestParams,
  normalizeListFilters,
} from "@/lib/list-query";

export type StudentListItem = {
  id: string;
  membership?: { user?: { name?: string | null; email?: string | null } };
};

export type StudentsListResponse = {
  data?: StudentListItem[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
};

type UseStudentsListParams = {
  enabled: boolean;
  query?: {
    yearId?: string | null;
    classSectionId?: string | null;
    availableForClassSectionId?: string | null;
    availableForYearId?: string | null;
    page?: number;
    limit?: number;
    search?: string | null;
  };
};

const EMPTY_STUDENTS: StudentListItem[] = [];

export function useStudentsList({ enabled, query }: UseStudentsListParams) {
  const normalizedFilters = useMemo(
    () =>
      normalizeListFilters({
        yearId: query?.yearId ?? null,
        classSectionId: query?.classSectionId ?? null,
        availableForClassSectionId: query?.availableForClassSectionId ?? null,
        availableForYearId: query?.availableForYearId ?? null,
        page: query?.page ?? 1,
        limit: query?.limit ?? 20,
        search: query?.search ?? null,
      }),
    [
      query?.availableForClassSectionId,
      query?.availableForYearId,
      query?.classSectionId,
      query?.limit,
      query?.page,
      query?.search,
      query?.yearId,
    ],
  );

  const queryResult = useQuery<StudentsListResponse>({
    queryKey: buildListQueryKey("students", normalizedFilters),
    enabled,
    staleTime: 15_000,
    queryFn: () =>
      fetchWithAuth<StudentsListResponse>("GET", "/students", {
        query: buildListRequestParams(normalizedFilters),
      }),
  });

  return useMemo(
    () => ({
      students: queryResult.data?.data ?? EMPTY_STUDENTS,
      meta: queryResult.data?.meta ?? null,
      loading: queryResult.isLoading,
      error: queryResult.error,
      refetch: queryResult.refetch,
      filters: normalizedFilters,
    }),
    [normalizedFilters, queryResult.data, queryResult.error, queryResult.isLoading, queryResult.refetch],
  );
}
