"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type ClassroomDetail = {
  id: string;
  label?: string | null;
  grade: string;
  section: string;
  teacher?: { id?: string; membership?: { user?: { name?: string | null; email?: string | null } } };
  enrollments?: {
    id: string;
    studentId: string;
    student?: {
      membership?: {
        user?: {
          name?: string | null;
        };
      };
    };
  }[];
  academicYear?: { id: string; label: string; isCurrent: boolean };
};

export const useClassroomDetail = (
  classroomId: string | null,
): {
  detail: ClassroomDetail | null;
  loading: boolean;
  refetch: () => Promise<boolean>;
} => {
  const [detail, setDetail] = useState<ClassroomDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (): Promise<boolean> => {
    if (!classroomId) {
      setDetail(null);
      return false;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const data = await fetchWithAuth<ClassroomDetail>("GET", `/classrooms/${classroomId}`, {
        signal: ac.signal,
      });
      if (ac.signal.aborted) return false;
      setDetail(data ?? null);
      return true;
    } catch {
      if (ac.signal.aborted) return false;
      setDetail(null);
      return false;
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { detail, loading, refetch };
};
