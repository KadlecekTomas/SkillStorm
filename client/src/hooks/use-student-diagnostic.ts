"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import type { StudentDiagnosticResponse } from "@/lib/api/students";

const FORBIDDEN_MESSAGE = "Nemáte oprávnění zobrazit diagnostiku žáka.";

export function useStudentDiagnostic(
  studentId: string | null,
  yearId?: string | null,
): {
  diagnostic: StudentDiagnosticResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
} {
  const [diagnostic, setDiagnostic] = useState<StudentDiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(!!studentId);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (): Promise<boolean> => {
    if (!studentId) {
      setDiagnostic(null);
      setError(null);
      return false;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const qs = yearId ? `?yearId=${encodeURIComponent(yearId)}` : "";
      const data = await fetchWithAuth<StudentDiagnosticResponse>(
        "GET",
        `/students/${studentId}/diagnostic${qs}`,
        { signal: ac.signal },
      );
      if (ac.signal.aborted) return false;
      setDiagnostic(data);
      return true;
    } catch (e) {
      if (ac.signal.aborted) return false;
      setDiagnostic(null);
      if (e instanceof HttpError && e.status === 403) {
        setError(FORBIDDEN_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst diagnostiku žáka.");
      }
      return false;
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [studentId, yearId]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { diagnostic, loading, error, refetch };
}
