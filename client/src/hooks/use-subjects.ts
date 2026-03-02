"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { Subject } from "@/types";

export function useSubjects(): {
  subjects: Subject[];
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
} {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchWithAuth<Subject[] | { data: Subject[] }>("GET", "/subjects?limit=200");
      const items = Array.isArray(res) ? res : ((res as { data?: Subject[] }).data ?? []);
      setSubjects(items);
    } catch {
      setSubjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { subjects, loading, error, refetch };
}

/** Human-readable label for a Subject. */
export function subjectLabel(s: Subject): string {
  return s.catalogSubject?.name ?? s.name;
}
