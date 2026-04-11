"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { OrgSubjectOption } from "@/types";

type UseOrgSubjectsOptions = {
  grade?: number;
  includeDisabled?: boolean;
  enabled?: boolean;
  softFail?: boolean;
  warningContext?: string;
};

export function useOrgSubjects(options: UseOrgSubjectsOptions = {}): {
  subjects: OrgSubjectOption[];
  loading: boolean;
  error: boolean;
  errorMessage: string | null;
  refetch: () => Promise<void>;
} {
  const {
    grade,
    includeDisabled = false,
    enabled = true,
    softFail = false,
    warningContext = "org-subjects",
  } = options;
  const [subjects, setSubjects] = useState<OrgSubjectOption[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setSubjects([]);
      setLoading(false);
      setError(false);
      setErrorMessage(null);
      return;
    }
    setLoading(true);
    setError(false);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams();
      if (grade != null) query.set("grade", String(grade));
      if (includeDisabled) query.set("includeDisabled", "true");
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const data = await fetchWithAuth<OrgSubjectOption[]>("GET", `/org-subjects${suffix}`);
      setSubjects(Array.isArray(data) ? data : []);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Nepodařilo se načíst předměty organizace.";
      console.warn(`[${warningContext}] optional org-subjects request failed`, caughtError);
      setSubjects([]);
      setError(!softFail);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, grade, includeDisabled, softFail, warningContext]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { subjects, loading, error, errorMessage, refetch };
}

export function subjectLabel(s: OrgSubjectOption): string {
  return `${s.subject.name} (${s.subject.gradeFrom}–${s.subject.gradeTo})`;
}
