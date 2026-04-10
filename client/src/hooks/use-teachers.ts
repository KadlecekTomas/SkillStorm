"use client";

import { useMemo } from "react";
import { httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import type { OrganizationRole } from "@/types";
import { useQuery } from "@/lib/query-client";

export type TeacherListItem = {
  id: string;
  createdAt?: string;
  membership?: {
    id?: string;
    role?: OrganizationRole | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

export type TeacherListResponse = {
  items: TeacherListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type UseTeachersResult = {
  teachers: TeacherListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  orgId: string | null;
};

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error) return error.message;
  return "Nepodařilo se načíst učitele.";
};

export const useTeachers = (): UseTeachersResult => {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const query = useQuery<TeacherListResponse>({
    queryKey: ["teachers", orgId],
    enabled: !!orgId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orgId) {
        return {
          items: [],
          meta: { page: 1, limit: 50, total: 0, pages: 1 },
        };
      }
      return httpClient.get<TeacherListResponse>("/teachers", {
        query: { organizationId: orgId, page: 1, limit: 50 },
      });
    },
  });

  return useMemo(
    () => ({
      teachers: query.data?.items ?? [],
      total: query.data?.meta?.total ?? query.data?.items?.length ?? 0,
      loading: query.isLoading,
      error: !orgId ? "Chybí aktivní organizace." : query.error ? resolveErrorMessage(query.error) : null,
      refresh: async () => {
        await query.refetch();
      },
      orgId,
    }),
    [orgId, query],
  );
};
