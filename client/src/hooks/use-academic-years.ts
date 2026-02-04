"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import type { AcademicYear } from "@/types";
import { fetchCurrentAcademicYear } from "@/lib/api/academic-years";

type UseAcademicYearsResult = {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  isReadOnly: boolean;
  status: "loading" | "ready" | "error";
  bootstrapState: "INIT" | "LOADING" | "READY" | "ERROR";
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
  const [bootstrapState, setBootstrapState] = useState<"INIT" | "LOADING" | "READY" | "ERROR">("INIT");
  const [error, setError] = useState<string | null>(null);
  const [yearConfigError, setYearConfigError] = useState<string | null>(null);

  const [currentYear, setCurrentYear] = useState<{ id: string; name: string } | null>(null);
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

    // Capture orgId at request start to guard against org switches during the fetch.
    const requestOrgId = orgId;

    setLoading(true);
    setStatus("loading");
    try {
      const data = await fetchWithAuth<AcademicYear[]>("GET", "/academic-years");
      const list = data ?? [];

      // Ignore stale responses that complete after an organization switch.
      if (requestOrgId !== orgId) {
        return;
      }

      setYears(list);
      setError(null);
      setStatus("ready");
    } catch (err) {
      if (requestOrgId !== orgId) {
        return;
      }
      const message = err instanceof Error ? err.message : "Nepodařilo se načíst školní roky";
      setError(message);
      setStatus("error");
    } finally {
      if (requestOrgId === orgId) {
        setLoading(false);
      }
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setYears([]);
      setCurrentYear(null);
      setError(null);
      setYearConfigError(null);
      setBootstrapState("INIT");
      return;
    }
    void refresh();
  }, [orgId, refresh]);

  useEffect(() => {
    if (!orgId) return;
    if (currentYear && selectedYearId === currentYear.id) return;
    if (selectedYearId && years.length > 0 && !years.some((year) => year.id === selectedYearId)) {
      clearOrg(orgId);
    }
  }, [orgId, selectedYearId, years, currentYear, clearOrg]);

  useEffect(() => {
    if (!orgId) return;
    setBootstrapState("LOADING");
    setCurrentYear(null);
    let cancelled = false;
    const activeOrgId = orgId;
    fetchCurrentAcademicYear()
      .then((current) => {
        if (cancelled) return;
        setCurrentYear(current);
        setSelected(activeOrgId, current.id);
        setYearConfigError(null);
        setBootstrapState("READY");
      })
      .catch((err) => {
        if (cancelled) return;
        const data = err instanceof HttpError ? (err.data as { code?: string; meta?: { code?: string } } | undefined) : undefined;
        const code =
          err instanceof HttpError && (err.status === 409 || err.status === 403 || err.status === 500)
            ? data?.meta?.code ?? data?.code ?? null
            : "ACTIVE_YEAR_FETCH_FAILED";
        setCurrentYear(null);
        clearOrg(activeOrgId);
        setYearConfigError(code ?? "UNKNOWN");
        setBootstrapState("ERROR");
        const message = err instanceof Error ? err.message : "Nepodařilo se načíst aktivní školní rok";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, setSelected, clearOrg]);

  const effectiveSelectedYear = useMemo((): AcademicYear | null => {
    if (bootstrapState !== "READY" || !currentYear || !orgId) return null;
    return {
      id: currentYear.id,
      name: currentYear.name,
      organizationId: orgId,
      startDate: "",
      endDate: "",
      isActive: true,
      createdAt: "",
    };
  }, [bootstrapState, currentYear, orgId]);
  const activeYear = effectiveSelectedYear;
  const isReadOnly = effectiveSelectedYear ? !effectiveSelectedYear.isActive : false;

  const setSelectedYearId = useCallback(
    (yearId: string) => {
      if (!orgId) return;
      if (bootstrapState !== "READY") return;
      if (yearConfigError) return;
      setSelected(orgId, yearId);
    },
    [orgId, setSelected, yearConfigError, bootstrapState],
  );

  return {
    years,
    activeYear,
    selectedYear: effectiveSelectedYear,
    selectedYearId: effectiveSelectedYear?.id ?? null,
    isReadOnly,
    status,
    bootstrapState,
    loading,
    error,
    yearConfigError,
    refresh,
    setSelectedYearId,
    setSelectedYear: setSelectedYearId,
  };
};
