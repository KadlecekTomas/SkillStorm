"use client";

import { useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

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
  const query = useQuery<ClassroomDetail>({
    queryKey: ["classroom-detail", classroomId],
    enabled: !!classroomId,
    staleTime: 10_000,
    queryFn: () => fetchWithAuth<ClassroomDetail>("GET", `/classrooms/${classroomId}`),
  });
  const data = query.data;
  const isLoading = query.isLoading;
  const refetch = query.refetch;

  return useMemo(
    () => ({
      detail: data ?? null,
      loading: isLoading,
      refetch: async () => !!(await refetch()),
    }),
    [data, isLoading, refetch],
  );
};
