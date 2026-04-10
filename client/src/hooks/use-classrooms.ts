"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { fetchWithAuth } from "@/lib/http/client";

/* =======================
   Types
======================= */

export type ClassroomListItem = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
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

type ClassroomsAction =
  | { type: "AUTH_LOADING" }
  | { type: "INIT_ORG" }
  | { type: "FETCHING" }
  | { type: "READY"; classrooms: ClassroomListItem[]; meta: ClassroomsMeta }
  | { type: "ERROR"; error: Error };

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

/* =======================
   Reducer
======================= */

const reducer = (state: ClassroomsState, action: ClassroomsAction): ClassroomsState => {
  switch (action.type) {
    case "AUTH_LOADING":
      return { status: "AUTH_LOADING" };

    case "INIT_ORG":
      return { status: "INIT_ORG" };

    case "FETCHING":
      return { status: "FETCHING" };

    case "READY":
      return action.classrooms.length === 0
        ? { status: "READY_EMPTY", classrooms: action.classrooms, meta: action.meta }
        : { status: "READY_WITH_DATA", classrooms: action.classrooms, meta: action.meta };

    case "ERROR":
      return { status: "ERROR", error: action.error };

    default:
      return state;
  }
};

/* =======================
   Helpers
======================= */

const isRepairState = (b: OrgBootstrapForInit) =>
  b?.hasClassrooms === true &&
  (b?.hasClassroomsInCurrentYear === false || (b?.hasClassroomsInCurrentYear !== true && b?.hasClassroomsInActiveYear === false));

/* =======================
   Hook
======================= */

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
  const [state, dispatch] = useReducer(reducer, { status: "AUTH_LOADING" });
  const abortRef = useRef<AbortController | null>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, FetchResult>>(new Map());
  const prefetchInFlightRef = useRef<Set<string>>(new Set());

  const isInitOrg =
    orgStatus === "ACTIVE" &&
    orgReadiness === "NOT_READY" &&
    !isRepairState(bootstrap);

  const buildQueryKey = useCallback(
    (targetCursor: string | null, targetDirection: "next" | "prev") =>
      JSON.stringify({
        yearId: selectedYearId ?? "",
        grade: grade ?? "",
        search: search ?? "",
        teacherId: teacherId ?? "",
        cursor: targetCursor ?? "",
        direction: targetDirection,
        limit,
      }),
    [selectedYearId, grade, search, teacherId, limit],
  );

  const fetchPage = useCallback(
    async (
      targetCursor: string | null,
      targetDirection: "next" | "prev",
      signal: AbortSignal,
    ): Promise<FetchResult> => {
      const response = await fetchWithAuth<
        | { data?: ClassroomListItem[]; meta?: ClassroomsMeta }
        | ClassroomListItem[]
      >(
        "GET",
        "/classrooms",
        {
          query: {
            yearId: selectedYearId ?? undefined,
            limit,
            ...(targetCursor ? { cursor: targetCursor, direction: targetDirection } : {}),
            ...(grade ? { grade } : {}),
            ...(search ? { search } : {}),
            ...(teacherId ? { teacherId } : {}),
          },
          signal,
        },
      );

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
    [selectedYearId, grade, search, teacherId, limit],
  );

  const refetch = useCallback(async (options?: { bypassCache?: boolean; skipFetch?: boolean }): Promise<boolean> => {
    const bypassCache = options?.bypassCache === true;
    const skipFetch = options?.skipFetch === true;

    /* 1️⃣ Auth gate */
    if (isAuthLoading || !isAuthenticated) {
      dispatch({ type: "AUTH_LOADING" });
      return false;
    }

    /* 2️⃣ Init org gate: show INIT_ORG only when no year selected (so after create + refetch we always fetch when year is set) */
    if (isInitOrg && !selectedYearId) {
      dispatch({ type: "INIT_ORG" });
      return false;
    }

    /* 3️⃣ No year selected → empty but READY */
    if (!selectedYearId) {
      dispatch({
        type: "READY",
        classrooms: [],
        meta: {
          limit,
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
          prevCursor: null,
        },
      });
      return false;
    }

    const effectiveDirection = cursor ? direction ?? "next" : "next";
    const queryKey = buildQueryKey(cursor, effectiveDirection);
    if (bypassCache) {
      cacheRef.current.clear();
      prefetchInFlightRef.current.clear();
      prefetchAbortRef.current?.abort();
      if (skipFetch) {
        return true;
      }
    } else {
      const cached = cacheRef.current.get(queryKey);
      if (cached) {
        dispatch({ type: "READY", classrooms: cached.data, meta: cached.meta });
        return true;
      }
    }

    /* 4️⃣ Real fetch */
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({ type: "FETCHING" });

    try {
      const fetched = await fetchPage(cursor, effectiveDirection, ac.signal);
      if (ac.signal.aborted) return false;
      cacheRef.current.set(queryKey, fetched);
      dispatch({ type: "READY", classrooms: fetched.data, meta: fetched.meta });
      return true;
    } catch (error) {
      if (ac.signal.aborted) return false;

      if (process.env.NODE_ENV !== "production") {
        console.error("Classrooms API error:", error);
      }

      const err = new Error("Nelze načíst seznam tříd. Zkuste stránku obnovit.");
      dispatch({ type: "ERROR", error: err });
      return false;
    }
  }, [
    isAuthLoading,
    isAuthenticated,
    isInitOrg,
    selectedYearId,
    cursor,
    direction,
    limit,
    buildQueryKey,
    fetchPage,
  ]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
      prefetchAbortRef.current?.abort();
    };
  }, [refetch]);

  useEffect(() => {
    cacheRef.current.clear();
    prefetchInFlightRef.current.clear();
    prefetchAbortRef.current?.abort();
  }, [selectedYearId, grade, search, teacherId, limit]);

  useEffect(() => {
    if (state.status !== "READY_EMPTY" && state.status !== "READY_WITH_DATA") return;
    if (!selectedYearId) return;
    if (!state.meta.hasNextPage || !state.meta.nextCursor) return;

    const nextCursor = state.meta.nextCursor;
    const nextKey = buildQueryKey(nextCursor, "next");
    if (cacheRef.current.has(nextKey) || prefetchInFlightRef.current.has(nextKey)) {
      return;
    }

    prefetchAbortRef.current?.abort();
    const ac = new AbortController();
    prefetchAbortRef.current = ac;
    prefetchInFlightRef.current.add(nextKey);

    void fetchPage(nextCursor, "next", ac.signal)
      .then((fetched) => {
        if (ac.signal.aborted) return;
        cacheRef.current.set(nextKey, fetched);
      })
      .catch(() => {
        // Prefetch is best-effort only.
      })
      .finally(() => {
        prefetchInFlightRef.current.delete(nextKey);
      });
  }, [state, selectedYearId, buildQueryKey, fetchPage]);

  return { ...state, refetch };
};
