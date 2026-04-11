"use client";

import { useOrgSubjects } from "@/hooks/use-org-subjects";
import type { OrgSubjectOption } from "@/types";
export { subjectLabel } from "@/hooks/use-org-subjects";

export function useSubjects(grade?: string): {
  subjects: OrgSubjectOption[];
  loading: boolean;
  error: boolean;
  errorMessage: string | null;
  refetch: () => Promise<void>;
} {
  const numericGrade = grade ? Number(grade.replace("GRADE_", "")) : undefined;
  const options =
    Number.isFinite(numericGrade) && numericGrade !== undefined
      ? { grade: numericGrade }
      : {};
  const { subjects, loading, error, errorMessage, refetch } = useOrgSubjects(options);
  return { subjects, loading, error, errorMessage, refetch };
}
