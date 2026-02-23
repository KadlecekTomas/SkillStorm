"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type SubjectPerformanceItem = {
  subjectId: string;
  name: string;
  gradeFrom: number;
  gradeTo: number;
  averageScorePercent: number;
  testCount: number;
  submissionCount: number;
  trend: "UP" | "DOWN" | "STABLE";
};

export type ClassroomSubjectPerformance = {
  classroomId: string;
  subjects: SubjectPerformanceItem[];
};

export function useClassroomSubjectPerformance(
  classroomId: string | null,
  academicYearId: string | null | undefined,
  enabled: boolean
): {
  data: ClassroomSubjectPerformance | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<ClassroomSubjectPerformance | null>(null);
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
      const query =
        academicYearId != null && academicYearId !== ""
          ? `?academicYearId=${encodeURIComponent(academicYearId)}`
          : "";
      const result = await fetchWithAuth<ClassroomSubjectPerformance>(
        "GET",
        `/classrooms/${classroomId}/subject-performance${query}`,
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
  }, [classroomId, academicYearId, enabled]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
