"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type RiskOverviewStudent = {
  studentId: string;
  displayName: string;
  averageScorePercent: number;
  lastActivityAt: string | null;
  trend: "UP" | "DOWN" | "STABLE";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskFlags: ("LOW_AVERAGE" | "INACTIVE" | "DECLINING")[];
};

export type ClassroomRiskOverview = {
  classroomId: string;
  students: RiskOverviewStudent[];
};

export function useClassroomRiskOverview(
  classroomId: string | null,
  enabled: boolean
): {
  data: ClassroomRiskOverview | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<ClassroomRiskOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!classroomId || !enabled) {
      setData(null);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWithAuth<ClassroomRiskOverview>(
        "GET",
        `/classrooms/${classroomId}/risk-overview`,
        { signal: ac.signal }
      );
      if (ac.signal.aborted) return;
      setData(result ?? null);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [classroomId, enabled]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
