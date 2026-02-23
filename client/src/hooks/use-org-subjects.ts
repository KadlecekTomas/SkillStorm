"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { OrgSubject } from "@/types";

export function useOrgSubjects(grade?: number): {
  subjects: OrgSubject[];
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
} {
  const [subjects, setSubjects] = useState<OrgSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const query = grade != null ? `?grade=${grade}` : "";
      const data = await fetchWithAuth<OrgSubject[]>("GET", `/org-subjects${query}`);
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [grade]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { subjects, loading, error, refetch };
}

export function subjectLabel(s: OrgSubject): string {
  return `${s.name} (${s.gradeFrom}–${s.gradeTo})`;
}
