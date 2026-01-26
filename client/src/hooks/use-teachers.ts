"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import type { OrganizationRole } from "@/types";

export type TeacherListItem = {
  id: string;
  createdAt?: string;
  membership?: {
    role?: OrganizationRole | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

export type TeacherListResponse = {
  items: TeacherListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type UseTeachersResult = {
  teachers: TeacherListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  orgId: string | null;
};

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Nepodařilo se načíst učitele.";
};

export const useTeachers = (): UseTeachersResult => {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    if (!orgId) {
      setTeachers([]);
      setTotal(0);
      setLoading(false);
      setError("Chybí aktivní organizace.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await httpClient.get<TeacherListResponse>("/teachers", {
        query: { organizationId: orgId, page: 1, limit: 50 },
      });
      setTeachers(response.items ?? []);
      setTotal(response.meta?.total ?? response.items?.length ?? 0);
    } catch (err) {
      setTeachers([]);
      setTotal(0);
      setError(resolveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  return useMemo(
    () => ({
      teachers,
      total,
      loading,
      error,
      refresh: fetchTeachers,
      orgId,
    }),
    [teachers, total, loading, error, fetchTeachers, orgId],
  );
};
