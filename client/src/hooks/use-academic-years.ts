"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import type { AcademicYear } from "@/types";
import { fetchActiveAcademicYear } from "@/lib/api/academic-years";

type UseAcademicYearsResult = {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  isReadOnly: boolean;
  status: "loading" | "ready" | "error";
  loading: boolean;
  error: string | null;
  yearConfigError: string | null;
  refresh: () => Promise<void>;
  setSelectedYearId: (yearId: string) => void;
  setSelectedYear: (yearId: string) => void;
};

export const useAcademicYears = (): UseAcademicYearsResult => {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [yearConfigError, setYearConfigError] = useState<string | null>(null);

  const selectedByOrg = useAcademicYearStore((state) => state.selectedByOrg);
  const setSelected = useAcademicYearStore((state) => state.setSelected);
  const clearOrg = useAcademicYearStore((state) => state.clearOrg);
  const selectedYearId = orgId ? selectedByOrg[orgId] ?? null : null;

  const refresh = useCallback(async () => {
    if (!orgId) {
      setYears([]);
      setError(null);
      setStatus("loading");
      return;
    }
    setLoading(true);
    setStatus("loading");
    try {
      const data = await fetchWithAuth<AcademicYear[]>("GET", "/academic-years");
      const list = data ?? [];
      setYears(list);
      setError(null);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nepodařilo se načíst školní roky";
      setError(message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setYears([]);
      setError(null);
      setYearConfigError(null);
      return;
    }
    void refresh();
  }, [orgId, refresh]);

  useEffect(() => {
    if (!orgId) return;
    if (selectedYearId && !years.some((year) => year.id === selectedYearId)) {
      clearOrg(orgId);
    }
  }, [orgId, selectedYearId, years, clearOrg]);

  useEffect(() => {
    if (!orgId) return;
    fetchActiveAcademicYear()
      .then((active) => {
        setSelected(orgId, active.id);
        setYearConfigError(null);
      })
      .catch((err) => {
        const code =
          err instanceof HttpError && err.status === 409
            ? (err.data as { meta?: { code?: string } } | undefined)?.meta?.code ??
              (err.data as { code?: string } | undefined)?.code ??
              null
            : "ACTIVE_YEAR_FETCH_FAILED";
        clearOrg(orgId);
        setYearConfigError(code ?? "UNKNOWN");
        const message = err instanceof Error ? err.message : "Nepodařilo se načíst aktivní školní rok";
        setError(message);
      });
  }, [orgId, setSelected, clearOrg]);

  const selectedYear = useMemo(
    () => years.find((year) => year.id === selectedYearId) ?? null,
    [years, selectedYearId],
  );

  const activeYear = selectedYear;
  const isReadOnly = selectedYear ? !selectedYear.isActive : false;

  const setSelectedYearId = useCallback(
    (yearId: string) => {
      if (!orgId) return;
      if (yearConfigError) return;
      setSelected(orgId, yearId);
    },
    [orgId, setSelected, yearConfigError],
  );

  return {
    years,
    activeYear,
    selectedYear,
    selectedYearId: selectedYear?.id ?? null,
    isReadOnly,
    status,
    loading,
    error,
    yearConfigError,
    refresh,
    setSelectedYearId,
    setSelectedYear: setSelectedYearId,
  };
};
