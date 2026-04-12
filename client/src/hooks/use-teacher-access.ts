"use client";

import { useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

export type TeacherAccessLevel = "VIEW" | "EDIT" | "HOMEROOM";

export type TeacherAccessItem = {
  id: string;
  teacherId: string;
  classSectionId: string;
  accessLevel: TeacherAccessLevel;
  validFrom?: string | null;
  validTo?: string | null;
  classSection: {
    id: string;
    label?: string | null;
    grade: string;
    section: string;
    yearId: string;
    academicYear?: { id: string; label: string; isCurrent: boolean } | null;
  };
};

const EMPTY_TEACHER_ACCESS_ITEMS: TeacherAccessItem[] = [];

export const useTeacherAccess = (teacherId: string | null, enabled = true) => {
  const query = useQuery<TeacherAccessItem[]>({
    queryKey: ["teacher-access", teacherId],
    enabled: enabled && !!teacherId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!teacherId) return [];
      const response = await fetchWithAuth<TeacherAccessItem[] | { data?: TeacherAccessItem[] }>(
        "GET",
        "/teacher-access",
        { query: { teacherId } },
      );
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  return useMemo(
    () => ({
      items: query.data ?? EMPTY_TEACHER_ACCESS_ITEMS,
      loading: query.isLoading,
      error: query.error instanceof Error ? query.error.message : null,
      refetch: async () => !!(await query.refetch()),
    }),
    [query.data, query.error, query.isLoading, query.refetch],
  );
};
