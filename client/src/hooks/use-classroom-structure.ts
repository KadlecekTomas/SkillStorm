"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { ClassroomListItem } from "./use-classrooms";

// Extends the base list item with enriched top-level fields returned by the my-structure endpoint.
export type StructureClassItem = ClassroomListItem & {
  studentCount: number;
  homeroomTeacherName: string | null;
};

export type ClassroomStructure = {
  homeroom: StructureClassItem | null;
  teachingClasses: StructureClassItem[];
  otherClasses: StructureClassItem[];
};

type State =
  | { status: "IDLE" }
  | { status: "LOADING" }
  | { status: "READY"; data: ClassroomStructure }
  | { status: "ERROR"; error: Error };

type UseClassroomStructureParams = {
  enabled: boolean;
};

export type ClassroomStructureResult = {
  data: ClassroomStructure | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export const useClassroomStructure = ({
  enabled,
}: UseClassroomStructureParams): ClassroomStructureResult => {
  const [state, setState] = useState<State>({ status: "IDLE" });
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async (signal: AbortSignal) => {
    setState({ status: "LOADING" });
    try {
      const response = await fetchWithAuth<{ data?: ClassroomStructure } | ClassroomStructure>(
        "GET",
        "/classrooms/my-structure",
        { signal },
      );
      if (signal.aborted) return;
      const data = (response as { data?: ClassroomStructure }).data ?? (response as ClassroomStructure);
      setState({ status: "READY", data });
    } catch (error) {
      if (signal.aborted) return;
      console.warn("[classrooms] optional classroom structure request failed", error);
      setState({
        status: "ERROR",
        error: error instanceof Error ? error : new Error("Nepodařilo se načíst strukturu tříd"),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    if (!enabled) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void doFetch(ac.signal);
  }, [enabled, doFetch]);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "IDLE" });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void doFetch(ac.signal);
    return () => {
      ac.abort();
    };
  }, [enabled, doFetch]);

  return {
    data: state.status === "READY" ? state.data : null,
    loading: state.status === "LOADING",
    error: state.status === "ERROR" ? state.error : null,
    refetch,
  };
};
