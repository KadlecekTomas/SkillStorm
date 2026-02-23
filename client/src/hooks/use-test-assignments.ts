"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type MyAssignmentItem = {
  id: string;
  testId: string;
  classSectionId: string | null;
  openAt: string;
  closeAt: string;
};

export type TestAssignmentSummary = {
  count: number;
  activeCount: number;
  /** Single class label when count === 1 and we have a label */
  singleClassLabel: string | null;
};

function isActive(openAt: string, closeAt: string): boolean {
  const now = Date.now();
  const open = new Date(openAt).getTime();
  const close = new Date(closeAt).getTime();
  return now >= open && now <= close;
}

export function useTestAssignments(yearId: string | null): {
  byTestId: Record<string, TestAssignmentSummary>;
  classSectionLabels: Record<string, string>;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [assignments, setAssignments] = useState<MyAssignmentItem[]>([]);
  const [classSectionLabels, setClassSectionLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentsData, sectionsData] = await Promise.allSettled([
        fetchWithAuth<MyAssignmentItem[] | { data?: MyAssignmentItem[] }>("GET", "/assignments/my"),
        yearId
          ? fetchWithAuth<Array<{ id: string; label?: string | null; grade?: string; section?: string }> | { data?: Array<{ id: string; label?: string | null; grade?: string; section?: string }> }>(
              "GET",
              "/class-sections",
              { query: { yearId } },
            )
          : Promise.resolve(null),
      ]);

      const list: MyAssignmentItem[] = [];
      if (assignmentsData.status === "fulfilled" && assignmentsData.value) {
        const raw = assignmentsData.value;
        const arr = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "data" in raw ? (raw as { data?: MyAssignmentItem[] }).data : null) ?? [];
        list.push(...(Array.isArray(arr) ? arr : []));
      }

      const labelMap: Record<string, string> = {};
      if (sectionsData.status === "fulfilled" && sectionsData.value) {
        const raw = sectionsData.value;
        const arr = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "data" in raw ? (raw as { data?: Array<{ id: string; label?: string | null; grade?: string; section?: string }> }).data : null) ?? [];
        const sections = Array.isArray(arr) ? arr : [];
        sections.forEach((s) => {
          const label = (s.label ?? [s.grade, s.section].filter(Boolean).join(" ")) || s.id;
          labelMap[s.id] = label;
        });
      }

      setAssignments(list);
      setClassSectionLabels(labelMap);
    } catch {
      setAssignments([]);
      setClassSectionLabels({});
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const byTestId: Record<string, TestAssignmentSummary> = {};
  assignments.forEach((a) => {
    if (!a.testId) return;
    const cur = byTestId[a.testId] ?? { count: 0, activeCount: 0, singleClassLabel: null };
    cur.count += 1;
    if (isActive(a.openAt, a.closeAt)) cur.activeCount += 1;
    if (cur.count === 1 && a.classSectionId) {
      cur.singleClassLabel = classSectionLabels[a.classSectionId] ?? a.classSectionId;
    } else if (cur.count > 1) {
      cur.singleClassLabel = null;
    }
    byTestId[a.testId] = cur;
  });

  return { byTestId, classSectionLabels, loading, refetch };
}
