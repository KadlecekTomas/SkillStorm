"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import type { OrgSubject } from "@/types";

export function useClassSectionOrgSubjects(
  classSectionId: string | null,
  enabled = true,
): {
  subjects: OrgSubject[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  attach: (orgSubjectIds: string[], replaceAll?: boolean) => Promise<OrgSubject[]>;
} {
  const [subjects, setSubjects] = useState<OrgSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!classSectionId || !enabled) {
      setSubjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth<OrgSubject[]>(
        "GET",
        `/class-sections/${classSectionId}/org-subjects`,
      );
      setSubjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setSubjects([]);
      setError(e instanceof Error ? e.message : "Nepodařilo se načíst předměty třídy.");
    } finally {
      setLoading(false);
    }
  }, [classSectionId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const attach = useCallback(
    async (orgSubjectIds: string[], replaceAll = false): Promise<OrgSubject[]> => {
      if (!classSectionId) {
        throw new Error("Chybí vybraná třída.");
      }
      setSaving(true);
      setError(null);
      try {
        const data = await fetchWithAuth<OrgSubject[]>(
          "POST",
          `/class-sections/${classSectionId}/org-subjects`,
          {
            body: {
              orgSubjectIds,
              replaceAll,
            },
          },
        );
        const list = Array.isArray(data) ? data : [];
        setSubjects(list);
        return list;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Nepodařilo se uložit předměty třídy.";
        setError(message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [classSectionId],
  );

  return { subjects, loading, saving, error, refetch, attach };
}
