"use client";

import { useCallback } from "react";
import { httpClient } from "@/lib/http/client";
import { queryClient, useQuery } from "@/lib/query-client";
import type { CatalogSubjectListResponse } from "@/components/platform/catalog/types";

export type CatalogSubjectQuery = {
  search: string;
  page: number;
  limit?: number;
  includeInactive: boolean;
  sortBy: "name" | "code" | "createdAt";
  sortDir: "asc" | "desc";
};

const EMPTY_SUBJECTS: CatalogSubjectListResponse["items"] = [];
const EMPTY_META: CatalogSubjectListResponse["meta"] = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

export function useCatalogSubjects(query: CatalogSubjectQuery): {
  items: CatalogSubjectListResponse["items"];
  meta: CatalogSubjectListResponse["meta"];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<CatalogSubjectListResponse | undefined>;
  createSubject: (input: { code: string; name: string }) => Promise<unknown>;
  updateSubject: (
    id: string,
    input: { code?: string; name?: string; isActive?: boolean },
  ) => Promise<unknown>;
  deleteSubject: (id: string) => Promise<unknown>;
} {
  const requestQuery = {
    search: query.search || undefined,
    page: query.page,
    limit: query.limit ?? 10,
    includeInactive: query.includeInactive,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
  const queryResult = useQuery<CatalogSubjectListResponse>({
    queryKey: [
      "platform-catalog-subjects",
      query.search,
      query.page,
      query.limit ?? 10,
      query.includeInactive,
      query.sortBy,
      query.sortDir,
    ],
    queryFn: async () =>
      await httpClient.get<CatalogSubjectListResponse>(
        "/platform/catalog/subjects",
        {
          query: requestQuery,
          cache: "no-store",
        },
      ),
    staleTime: 5_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(["platform-catalog-subjects"]);
    queryClient.invalidateQueries(["platform-catalog-topics"]);
  }, []);

  const createSubject = useCallback(
    async (input: { code: string; name: string }) => {
      const result = await httpClient.post("/platform/catalog/subjects", input);
      invalidate();
      return result;
    },
    [invalidate],
  );

  const updateSubject = useCallback(
    async (
      id: string,
      input: { code?: string; name?: string; isActive?: boolean },
    ) => {
      const result = await httpClient.patch(
        `/platform/catalog/subjects/${id}`,
        input,
      );
      invalidate();
      return result;
    },
    [invalidate],
  );

  const deleteSubject = useCallback(
    async (id: string) => {
      const result = await httpClient.delete(
        `/platform/catalog/subjects/${id}`,
      );
      invalidate();
      return result;
    },
    [invalidate],
  );

  return {
    items: queryResult.data?.items ?? EMPTY_SUBJECTS,
    meta: queryResult.data?.meta ?? EMPTY_META,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
    createSubject,
    updateSubject,
    deleteSubject,
  };
}
