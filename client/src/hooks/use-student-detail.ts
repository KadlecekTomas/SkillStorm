"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import type { StudentDetailResponse } from "@/lib/api/students";
import { studentDetailAllowlist } from "@/lib/gdpr/allowlist";

const FORBIDDEN_MESSAGE = "Nemáte oprávnění zobrazit detail žáka.";

export function useStudentDetail(studentId: string | null): {
  detail: StudentDetailResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
} {
  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!studentId);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (): Promise<boolean> => {
    if (!studentId) {
      setDetail(null);
      setError(null);
      return false;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth<StudentDetailResponse>(
        "GET",
        `/students/${studentId}/detail`,
        { signal: ac.signal },
      );
      if (ac.signal.aborted) return false;
      const safe = studentDetailAllowlist(data);
      setDetail(safe ?? null);
      return true;
    } catch (e) {
      if (ac.signal.aborted) return false;
      setDetail(null);
      if (e instanceof HttpError && e.status === 403) {
        setError(FORBIDDEN_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst detail žáka.");
      }
      return false;
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [studentId]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { detail, loading, error, refetch };
}
