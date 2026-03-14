"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { OrgSubjectOption } from "@/types";

type UseOrgSubjectsOptions = {
  grade?: number;
  includeDisabled?: boolean;
};

export function useOrgSubjects(options: UseOrgSubjectsOptions = {}): {
  subjects: OrgSubjectOption[];
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
} {
  const { grade, includeDisabled = false } = options;
  const [subjects, setSubjects] = useState<OrgSubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams();
      if (grade != null) query.set("grade", String(grade));
      if (includeDisabled) query.set("includeDisabled", "true");
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const data = await fetchWithAuth<OrgSubjectOption[]>("GET", `/org-subjects${suffix}`);
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [grade, includeDisabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { subjects, loading, error, refetch };
}

export function subjectLabel(s: OrgSubjectOption): string {
  return `${s.subject.name} (${s.subject.gradeFrom}–${s.subject.gradeTo})`;
}
