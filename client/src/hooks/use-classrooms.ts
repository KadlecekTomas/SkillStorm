"use client";

import { useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";
import { normalizeClassroomsFilters } from "@/lib/classrooms/list-filters";

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

const EMPTY_CLASSROOMS: ClassroomListItem[] = [];
const buildDefaultMeta = (limit: number): ClassroomsMeta => ({
  limit,
  hasNextPage: false,
  hasPrevPage: false,
  nextCursor: null,
  prevCursor: null,
});

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
  const normalizedFilters = useMemo(
    () =>
      normalizeClassroomsFilters({
        selectedYearId,
        grade,
        search,
        teacherId,
        cursor,
        direction,
        limit,
      }),
    [selectedYearId, grade, search, teacherId, cursor, direction, limit],
  );
  const defaultMeta = useMemo(
    () => buildDefaultMeta(normalizedFilters.limit),
    [normalizedFilters.limit],
  );

  const queryKey = useMemo(
    () =>
      [
        "classrooms",
        normalizedFilters.selectedYearId,
        normalizedFilters.grade,
        normalizedFilters.search,
        normalizedFilters.teacherId,
        normalizedFilters.cursor,
        normalizedFilters.direction,
        normalizedFilters.limit,
      ] as const,
    [normalizedFilters],
  );

  const query = useQuery<FetchResult>({
    queryKey,
    enabled:
      !isAuthLoading &&
      isAuthenticated &&
      !(isInitOrg && !normalizedFilters.selectedYearId) &&
      !!normalizedFilters.selectedYearId,
    staleTime: 10_000,
    queryFn: async () => {
      const response = await fetchWithAuth<
        | { data?: ClassroomListItem[]; meta?: ClassroomsMeta }
        | ClassroomListItem[]
      >("GET", "/classrooms", {
        query: {
          yearId: normalizedFilters.selectedYearId ?? undefined,
          limit: normalizedFilters.limit,
          ...(normalizedFilters.cursor
            ? {
                cursor: normalizedFilters.cursor,
                direction: normalizedFilters.direction,
              }
            : {}),
          ...(normalizedFilters.grade ? { grade: normalizedFilters.grade } : {}),
          ...(normalizedFilters.search ? { search: normalizedFilters.search } : {}),
          ...(normalizedFilters.teacherId ? { teacherId: normalizedFilters.teacherId } : {}),
        },
      });

      const data = Array.isArray(response) ? response : response?.data ?? EMPTY_CLASSROOMS;
      const meta = Array.isArray(response)
        ? defaultMeta
        : response?.meta ?? defaultMeta;

      return { data, meta };
    },
  });
  const queryRefetch = query.refetch;

  const refetch = useCallback(async (options?: { bypassCache?: boolean; skipFetch?: boolean }) => {
    if (options?.skipFetch) return true;
    if (isAuthLoading || !isAuthenticated) return false;
    if (isInitOrg && !normalizedFilters.selectedYearId) return false;
    if (!normalizedFilters.selectedYearId) return false;
    return !!(await queryRefetch());
  }, [isAuthLoading, isAuthenticated, isInitOrg, normalizedFilters.selectedYearId, queryRefetch]);

  if (isAuthLoading || !isAuthenticated) {
    return { status: "AUTH_LOADING", refetch };
  }

  if (isInitOrg && !normalizedFilters.selectedYearId) {
    return { status: "INIT_ORG", refetch };
  }

  if (!normalizedFilters.selectedYearId) {
    return {
      status: "READY_EMPTY",
      classrooms: EMPTY_CLASSROOMS,
      meta: defaultMeta,
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

  const classrooms = query.data?.data ?? EMPTY_CLASSROOMS;
  const meta = query.data?.meta ?? defaultMeta;

  return classrooms.length === 0
    ? { status: "READY_EMPTY", classrooms, meta, refetch }
    : { status: "READY_WITH_DATA", classrooms, meta, refetch };
};
