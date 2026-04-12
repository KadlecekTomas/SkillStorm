"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type PlatformOrganization = {
  id: string;
  name: string;
  /**
   * Authoritative platform status – mirrors backend OrganizationStatus:
   * PENDING | ACTIVE | SUSPENDED.
   */
  status: string;
  createdAt: string;
  ownerEmail: string | null;
  membershipsCount: number;
  studentsCount: number;
  classroomsCount: number;
  /** Canonical: org has exactly one current academic year. */
  hasCurrentAcademicYear: boolean;
  hasAnyClassSectionInCurrentYear: boolean;
  /** @deprecated Use hasCurrentAcademicYear. Accepted from API for backward compat. */
  hasActiveAcademicYear?: boolean;
  /** @deprecated Use hasAnyClassSectionInCurrentYear. Accepted from API for backward compat. */
  hasAnyClassSectionInActiveYear?: boolean;
};

export type PlatformOrganizationsState =
  | { status: "initial-loading" }
  | { status: "refreshing"; items: PlatformOrganization[] }
  | { status: "error"; error: Error }
  | { status: "ready"; items: PlatformOrganization[] };

type ListResponse = {
  items: PlatformOrganization[];
  meta: { page: number; limit: number; total: number; pages: number };
};

type StateAction =
  | { type: "initial-loading" }
  | { type: "refreshing" }
  | { type: "ready"; items: PlatformOrganization[]; meta: ListResponse["meta"] }
  | { type: "error"; error: Error }
  | { type: "setAll"; items: PlatformOrganization[] }
  | { type: "upsert"; item: PlatformOrganization };

const reducer = (
  state: PlatformOrganizationsState,
  action: StateAction,
): PlatformOrganizationsState => {
  switch (action.type) {
    case "initial-loading":
      return { status: "initial-loading" };
    case "refreshing":
      if (state.status === "ready" || state.status === "refreshing") {
        return { status: "refreshing", items: state.items };
      }
      return state;
    case "ready":
      return { status: "ready", items: action.items };
    case "setAll":
      return { status: "ready", items: action.items };
    case "upsert": {
      if (state.status !== "ready") {
        return { status: "ready", items: [action.item] };
      }
      const idx = state.items.findIndex((o) => o.id === action.item.id);
      if (idx === -1) {
        return { status: "ready", items: [action.item, ...state.items] };
      }
      const next = [...state.items];
      next[idx] = action.item;
      return { status: "ready", items: next };
    }
    case "error":
      return { status: "error", error: action.error };
    default:
      return state;
  }
};

type UsePlatformOrganizationsOptions = {
  enabled?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

export const usePlatformOrganizations = (
  options: UsePlatformOrganizationsOptions = {},
): {
  state: PlatformOrganizationsState;
  meta: ListResponse["meta"] | null;
  refetch: (options?: { force?: boolean; silent?: boolean }) => Promise<boolean>;
  /**
   * Imperative helpers for SUPERADMIN flows that need strict, synchronous UX.
   * They never trigger network requests; they only adjust local list state.
   */
  setAll: (items: PlatformOrganization[]) => void;
  upsert: (item: PlatformOrganization) => void;
} => {
  const { enabled = true, query } = options;
  const [state, dispatch] = useReducer(reducer, { status: "initial-loading" as const });
  const metaRef = useRef<ListResponse["meta"] | null>(null);
  const aliveRef = useRef(true);

  const queryEntries = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  const querySignature = JSON.stringify(queryEntries);
  const stableQuery = useMemo(
    () =>
      Object.fromEntries(
        JSON.parse(querySignature) as Array<[string, string | number | boolean]>,
      ),
    [querySignature],
  );

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refetch = useCallback(
    async (opts?: { force?: boolean; silent?: boolean }): Promise<boolean> => {
      if (!enabled) return false;
      if (!aliveRef.current) return false;

      if (opts?.silent) {
        // Manual refresh → keep items, mark as "refreshing" only.
        dispatch({ type: "refreshing" });
      } else {
        dispatch({ type: "initial-loading" });
      }
    try {
      const queryWithBust =
        opts?.force === true
          ? { ...stableQuery, _t: Date.now() }
          : stableQuery;
      const config = {
        query: queryWithBust,
        cache: "no-store" as const,
        ...(opts?.force === true
          ? {
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            }
          : {}),
      };
      const res = await fetchWithAuth<ListResponse>(
        "GET",
        "/platform/organizations",
        config,
      );
      if (!aliveRef.current) return false;
      if (!res) {
        const error = new Error("Empty response");
        dispatch({ type: "error", error });
        metaRef.current = null;
        return false;
      }
      metaRef.current = res.meta;
      dispatch({ type: "ready", items: res.items, meta: res.meta });
      return true;
    } catch (error) {
      if (!aliveRef.current) return false;
      const err = error instanceof Error ? error : new Error("Fetch failed");
      dispatch({ type: "error", error: err });
      metaRef.current = null;
      return false;
    }
  },
    [enabled, stableQuery],
  );

  const setAll = useCallback((items: PlatformOrganization[]) => {
    dispatch({ type: "setAll", items });
  }, []);

  const upsert = useCallback((item: PlatformOrganization) => {
    dispatch({ type: "upsert", item });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refetch();
  }, [enabled, refetch]);

  return { state, meta: metaRef.current, refetch, setAll, upsert };
};
