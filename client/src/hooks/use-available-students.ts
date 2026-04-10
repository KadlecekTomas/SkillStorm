"use client";

import { useMemo } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useQuery } from "@/lib/query-client";

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
  const query = useQuery<{ data?: AvailableStudent[] }>({
    queryKey: ["students", "available", classSectionId, yearId],
    enabled: enabled && !!classSectionId && !!yearId,
    staleTime: 15_000,
    queryFn: () =>
      fetchWithAuth<{ data?: AvailableStudent[] }>("GET", "/students", {
        query: {
          availableForClassSectionId: classSectionId ?? undefined,
          availableForYearId: yearId ?? undefined,
          limit: "200",
        },
      }),
  });

  return useMemo(
    () => ({
      students: query.data?.data ?? [],
      loading: query.isLoading,
    }),
    [query.data, query.isLoading],
  );
};
