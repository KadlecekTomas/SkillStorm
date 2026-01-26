"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import type { AcademicYear } from "@/types";

type UseAcademicYearsResult = {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  isReadOnly: boolean;
  status: "loading" | "ready" | "error";
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSelectedYearId: (yearId: string) => void;
  setSelectedYear: (yearId: string) => void;
};

export const useAcademicYears = (): UseAcademicYearsResult => {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const { can } = usePermissions();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [bootstrapAttempted, setBootstrapAttempted] = useState(false);

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
      let list = data ?? [];
      let createdId: string | null = null;
      if (list.length === 0 && can(PermissionKey.MANAGE_TEACHERS) && !bootstrapAttempted) {
        // Auto-bootstrap first academic year so schools never get stuck without a year.
        const now = new Date();
        const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        const endYear = startYear + 1;
        const startDate = new Date(`${startYear}-09-01T00:00:00.000Z`);
        const endDate = new Date(`${endYear}-06-30T00:00:00.000Z`);
        const created = await fetchWithAuth<AcademicYear>("POST", "/academic-years", {
          body: {
            name: `${startYear}/${endYear}`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            isActive: true,
          },
        });
        setBootstrapAttempted(true);
        createdId = created?.id ?? null;
        const refreshed = await fetchWithAuth<AcademicYear[]>("GET", "/academic-years");
        list = refreshed ?? (created ? [created] : []);
      }
      setYears(list);
      setError(null);
      const hasSelected = selectedYearId && list.some((year) => year.id === selectedYearId);
      if (!hasSelected && list.length > 0) {
        const active = list.find((year) => year.isActive) ?? null;
        const [only] = list;
        const latest =
          list.length > 1
            ? [...list].sort(
                (a, b) =>
                  new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
              )[0]
            : null;
        const nextId =
          active?.id ?? createdId ?? only?.id ?? latest?.id ?? null;
        if (nextId) {
          setSelected(orgId, nextId);
        }
      }
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nepodařilo se načíst školní roky";
      setError(message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedYearId, setSelected, can, bootstrapAttempted]);

  useEffect(() => {
    if (!orgId) {
      setYears([]);
      setError(null);
      return;
    }
    void refresh();
  }, [orgId, refresh]);

  useEffect(() => {
    setBootstrapAttempted(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    if (selectedYearId && !years.some((year) => year.id === selectedYearId)) {
      clearOrg(orgId);
    }
  }, [orgId, selectedYearId, years, clearOrg]);

  const activeYear = useMemo(
    () => years.find((year) => year.isActive) ?? null,
    [years],
  );
  const selectedYear = useMemo(
    () => years.find((year) => year.id === selectedYearId) ?? activeYear ?? null,
    [years, selectedYearId, activeYear],
  );

  const isReadOnly = selectedYear ? !selectedYear.isActive : false;

  const setSelectedYearId = useCallback(
    (yearId: string) => {
      if (!orgId) return;
      setSelected(orgId, yearId);
    },
    [orgId, setSelected],
  );

  useEffect(() => {
    // Temporary diagnostics for AcademicYear selection/debugging.
    console.debug("useAcademicYears", {
      orgId,
      status,
      yearsCount: years.length,
      selectedYearId,
    });
  }, [orgId, status, years.length, selectedYearId]);

  return {
    years,
    activeYear,
    selectedYear,
    selectedYearId: selectedYear?.id ?? null,
    isReadOnly,
    status,
    loading,
    error,
    refresh,
    setSelectedYearId,
    setSelectedYear: setSelectedYearId,
  };
};
