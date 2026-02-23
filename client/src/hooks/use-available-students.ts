"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";

export type AvailableStudent = {
  id: string;
  membership?: { user?: { name?: string | null; email?: string | null } };
};

type UseAvailableStudentsParams = {
  enabled: boolean;
  classSectionId: string | null;
  yearId: string | null;
};

export const useAvailableStudents = ({
  enabled,
  classSectionId,
  yearId,
}: UseAvailableStudentsParams): {
  students: AvailableStudent[];
  loading: boolean;
} => {
  const [students, setStudents] = useState<AvailableStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !classSectionId || !yearId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setStudents([]);
    fetchWithAuth<{ data?: AvailableStudent[] }>("GET", "/students", {
      query: {
        availableForClassSectionId: classSectionId,
        availableForYearId: yearId,
        limit: "200",
      },
    })
      .then((res) => setStudents(res?.data ?? []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [enabled, classSectionId, yearId]);

  return { students, loading };
};
