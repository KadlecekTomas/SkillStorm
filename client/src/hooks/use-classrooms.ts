"use client";

import { useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

export type ClassroomListItem = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
  studentCount?: number;
  teacher?: {
    id?: string;
    membership?: {
      user?: { name?: string | null; email?: string | null };
    };
  };
  enrollments?: { id: string }[];
  _count?: {
    enrollments?: number;
  };
  academicYear?: { id: string; label: string; isCurrent: boolean };
};

export type ClassroomsMeta = {
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
};

export type ClassroomsState =
  | { status: "AUTH_LOADING" }
  | { status: "INIT_ORG" }
  | { status: "FETCHING" }
  | { status: "READY_EMPTY"; classrooms: ClassroomListItem[]; meta: ClassroomsMeta }
  | { status: "READY_WITH_DATA"; classrooms: ClassroomListItem[]; meta: ClassroomsMeta }
  | { status: "ERROR"; error: Error };

type OrgBootstrapForInit = {
  hasClassrooms?: boolean;
  hasClassroomsInCurrentYear?: boolean;
  hasClassroomsInActiveYear?: boolean;
} | null | undefined;

type UseClassroomsParams = {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  orgStatus: string | null;
  orgReadiness: string | null;
  bootstrap?: OrgBootstrapForInit;
  selectedYearId: string | null;
  grade?: string | null;
  search?: string | null;
  teacherId?: string | null;
  cursor?: string | null;
  direction?: "next" | "prev" | null;
  limit?: number;
};

const isRepairState = (b: OrgBootstrapForInit) =>
  b?.hasClassrooms === true &&
  (b?.hasClassroomsInCurrentYear === false || (b?.hasClassroomsInCurrentYear !== true && b?.hasClassroomsInActiveYear === false));

export type ClassroomsResult = ClassroomsState & {
  refetch: (options?: { bypassCache?: boolean; skipFetch?: boolean }) => Promise<boolean>;
};

type FetchResult = {
  data: ClassroomListItem[];
  meta: ClassroomsMeta;
};

export const useClassrooms = ({
  isAuthLoading,
  isAuthenticated,
  orgStatus,
  orgReadiness,
  bootstrap,
  selectedYearId,
  grade,
  search,
  teacherId,
  cursor = null,
  direction = "next",
  limit = 20,
}: UseClassroomsParams): ClassroomsResult => {
  const isInitOrg =
    orgStatus === "ACTIVE" &&
    orgReadiness === "NOT_READY" &&
    !isRepairState(bootstrap);

  const effectiveDirection = cursor ? direction ?? "next" : "next";
  const queryKey = useMemo(
    () =>
      [
        "classrooms",
        selectedYearId,
        grade ?? null,
        search ?? null,
        teacherId ?? null,
        cursor,
        effectiveDirection,
        limit,
      ] as const,
    [selectedYearId, grade, search, teacherId, cursor, effectiveDirection, limit],
  );

  const query = useQuery<FetchResult>({
    queryKey,
    enabled:
      !isAuthLoading &&
      isAuthenticated &&
      !(isInitOrg && !selectedYearId) &&
      !!selectedYearId,
    staleTime: 10_000,
    queryFn: async () => {
      const response = await fetchWithAuth<
        | { data?: ClassroomListItem[]; meta?: ClassroomsMeta }
        | ClassroomListItem[]
      >("GET", "/classrooms", {
        query: {
          yearId: selectedYearId ?? undefined,
          limit,
          ...(cursor ? { cursor, direction: effectiveDirection } : {}),
          ...(grade ? { grade } : {}),
          ...(search ? { search } : {}),
          ...(teacherId ? { teacherId } : {}),
        },
      });

      const data = Array.isArray(response) ? response : response?.data ?? [];
      const meta = Array.isArray(response)
        ? {
            limit,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
          }
        : response?.meta ?? {
            limit,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
          };

      return { data, meta };
    },
  });

  const refetch = useCallback(async (options?: { bypassCache?: boolean; skipFetch?: boolean }) => {
    if (options?.skipFetch) return true;
    if (isAuthLoading || !isAuthenticated) return false;
    if (isInitOrg && !selectedYearId) return false;
    if (!selectedYearId) return false;
    return !!(await query.refetch());
  }, [isAuthLoading, isAuthenticated, isInitOrg, selectedYearId, query]);

  if (isAuthLoading || !isAuthenticated) {
    return { status: "AUTH_LOADING", refetch };
  }

  if (isInitOrg && !selectedYearId) {
    return { status: "INIT_ORG", refetch };
  }

  if (!selectedYearId) {
    return {
      status: "READY_EMPTY",
      classrooms: [],
      meta: {
        limit,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
      refetch,
    };
  }

  if (query.isLoading && !query.data) {
    return { status: "FETCHING", refetch };
  }

  if (query.error) {
    return {
      status: "ERROR",
      error:
        query.error instanceof Error
          ? query.error
          : new Error("Nelze načíst seznam tříd. Zkuste stránku obnovit."),
      refetch,
    };
  }

  const classrooms = query.data?.data ?? [];
  const meta = query.data?.meta ?? {
    limit,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null,
  };

  return classrooms.length === 0
    ? { status: "READY_EMPTY", classrooms, meta, refetch }
    : { status: "READY_WITH_DATA", classrooms, meta, refetch };
};
