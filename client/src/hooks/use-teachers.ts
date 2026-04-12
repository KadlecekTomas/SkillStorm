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
  warning?: string | null;
};

export type UseTeachersResult = {
  teachers: TeacherListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  orgId: string | null;
};

type UseTeachersOptions = {
  enabled?: boolean;
  softFail?: boolean;
  warningContext?: string;
};

const EMPTY_TEACHERS: TeacherListItem[] = [];

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error) return error.message;
  return "Nepodařilo se načíst učitele.";
};

export const useTeachers = (options: UseTeachersOptions = {}): UseTeachersResult => {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const enabled = options.enabled ?? true;
  const softFail = options.softFail ?? false;
  const warningContext = options.warningContext ?? "teachers";
  const query = useQuery<TeacherListResponse>({
    queryKey: ["teachers", orgId],
    enabled: enabled && !!orgId,
    staleTime: 15_000,
    queryFn: async () => {
      const empty = {
        items: [],
        meta: { page: 1, limit: 50, total: 0, pages: 1 },
      };
      if (!orgId) return empty;
      try {
        return await httpClient.get<TeacherListResponse>("/teachers", {
          query: { organizationId: orgId, page: 1, limit: 50 },
        });
      } catch (error) {
        if (!softFail) throw error;
        console.warn(`[${warningContext}] optional teachers request failed`, error);
        return {
          ...empty,
          warning: resolveErrorMessage(error),
        };
      }
    },
  });
  const data = query.data;
  const isLoading = query.isLoading;
  const error = query.error;
  const refetch = query.refetch;

  return useMemo(
    () => ({
      teachers: data?.items ?? EMPTY_TEACHERS,
      total: data?.meta?.total ?? data?.items?.length ?? 0,
      loading: isLoading,
      error:
        !orgId
          ? "Chybí aktivní organizace."
          : softFail
            ? data?.warning ?? null
            : error
              ? resolveErrorMessage(error)
              : null,
      refresh: async () => {
        await refetch();
      },
      orgId,
    }),
    [
      data,
      error,
      isLoading,
      orgId,
      refetch,
      softFail,
    ],
  );
};
