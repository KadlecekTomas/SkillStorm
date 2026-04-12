"use client";

import { useMemo } from "react";
import { useStudentsList } from "@/hooks/use-students-list";

export type AvailableStudent = {
  id: string;
  membership?: { user?: { name?: string | null; email?: string | null } };
};

type UseAvailableStudentsParams = {
  enabled: boolean;
  classSectionId: string | null;
  yearId: string | null;
};

const EMPTY_AVAILABLE_STUDENTS: AvailableStudent[] = [];

export const useAvailableStudents = ({
  enabled,
  classSectionId,
  yearId,
}: UseAvailableStudentsParams): {
  students: AvailableStudent[];
  loading: boolean;
} => {
  const studentsQuery = useStudentsList({
    enabled: enabled && !!classSectionId && !!yearId,
    query: {
      availableForClassSectionId: classSectionId,
      availableForYearId: yearId,
      limit: 200,
    },
  });

  return useMemo(
    () => ({
      students: (studentsQuery.students as AvailableStudent[]) ?? EMPTY_AVAILABLE_STUDENTS,
      loading: studentsQuery.loading,
    }),
    [studentsQuery.loading, studentsQuery.students],
  );
};
