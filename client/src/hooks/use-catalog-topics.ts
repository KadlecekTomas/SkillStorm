"use client";

import { useCallback } from "react";
import { httpClient } from "@/lib/http/client";
import { queryClient, useQuery } from "@/lib/query-client";
import type { CatalogTopicListResponse } from "@/components/platform/catalog/types";

export type CatalogTopicQuery = {
  search: string;
  page: number;
  limit?: number;
  includeInactive: boolean;
  subjectId?: string | undefined;
};

const EMPTY_TOPICS: CatalogTopicListResponse["items"] = [];
const EMPTY_META: CatalogTopicListResponse["meta"] = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
};

export function useCatalogTopics(query: CatalogTopicQuery): {
  items: CatalogTopicListResponse["items"];
  meta: CatalogTopicListResponse["meta"];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<CatalogTopicListResponse | undefined>;
  createTopic: (input: {
    subjectId: string;
    name: string;
    order?: number;
  }) => Promise<unknown>;
  updateTopic: (
    id: string,
    input: { name?: string; order?: number; isActive?: boolean },
  ) => Promise<unknown>;
  deleteTopic: (id: string) => Promise<unknown>;
} {
  const requestQuery = {
    search: query.search || undefined,
    page: query.page,
    limit: query.limit ?? 10,
    includeInactive: query.includeInactive,
    ...(query.subjectId ? { subjectId: query.subjectId } : {}),
  };
  const queryResult = useQuery<CatalogTopicListResponse>({
    queryKey: [
      "platform-catalog-topics",
      query.search,
      query.page,
      query.limit ?? 10,
      query.includeInactive,
      query.subjectId ?? "",
    ],
    queryFn: async () =>
      await httpClient.get<CatalogTopicListResponse>(
        "/platform/catalog/topics",
        {
          query: requestQuery,
          cache: "no-store",
        },
      ),
    staleTime: 5_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(["platform-catalog-topics"]);
    queryClient.invalidateQueries(["platform-catalog-subjects"]);
  }, []);

  const createTopic = useCallback(
    async (input: { subjectId: string; name: string; order?: number }) => {
      const result = await httpClient.post("/platform/catalog/topics", input);
      invalidate();
      return result;
    },
    [invalidate],
  );

  const updateTopic = useCallback(
    async (
      id: string,
      input: { name?: string; order?: number; isActive?: boolean },
    ) => {
      const result = await httpClient.patch(
        `/platform/catalog/topics/${id}`,
        input,
      );
      invalidate();
      return result;
    },
    [invalidate],
  );

  const deleteTopic = useCallback(
    async (id: string) => {
      const result = await httpClient.delete(`/platform/catalog/topics/${id}`);
      invalidate();
      return result;
    },
    [invalidate],
  );

  return {
    items: queryResult.data?.items ?? EMPTY_TOPICS,
    meta: queryResult.data?.meta ?? EMPTY_META,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
    createTopic,
    updateTopic,
    deleteTopic,
  };
}
