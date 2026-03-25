"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import {
  usePlatformOrganizations,
  type PlatformOrganization,
} from "@/hooks/use-platform-organizations";
import { canMutatePlatform } from "@/utils/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";
import { Building2, Lock, RefreshCw } from "lucide-react";

type StatusFilter = "all" | "PENDING" | "ACTIVE" | "SUSPENDED";

function daysSince(dateStr: string): number {
  const created = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (24 * 60 * 60 * 1000));
}

export default function PlatformOrganizationsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PlatformOrganization | null>(null);
  const [confirmMode, setConfirmMode] = useState<"activate" | "suspend" | null>(
    null,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const aliveRef = useRef(true);
  const previousItemsRef = useRef<PlatformOrganization[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isSuperAdmin = canMutatePlatform(user);
  const query = useMemo(() => {
    const trimmed = search.trim();
    return trimmed ? { q: trimmed } : {};
  }, [search]);
  const { state, meta, refetch, setAll, upsert } = usePlatformOrganizations({
    query,
  });

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const approveOrganization = async (id: string): Promise<PlatformOrganization> => {
    return await fetchWithAuth<PlatformOrganization>(
      "POST",
      `/platform/organizations/${id}/activate`,
    );
  };

  const suspendOrganization = async (id: string): Promise<PlatformOrganization> => {
    return await fetchWithAuth<PlatformOrganization>(
      "POST",
      `/platform/organizations/${id}/suspend`,
    );
  };

  const reactivateOrganization = async (
    id: string,
  ): Promise<PlatformOrganization> => {
    return await fetchWithAuth<PlatformOrganization>(
      "POST",
      `/platform/organizations/${id}/reactivate`,
    );
  };

  // Explicit manual refresh:
  // Admin controls when data are reloaded.
  // Avoids polling, race conditions and unnecessary backend load.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const success = await refetch({ force: true, silent: true });
    if (success && aliveRef.current) {
      setLastUpdatedAt(new Date());
      showToastOnce("Data byla obnovena.", { type: "info" });
    }
    if (aliveRef.current) {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const openConfirm = (mode: "activate" | "suspend", org: PlatformOrganization) => {
    setConfirmMode(mode);
    setConfirmTarget(org);
    setConfirmOpen(true);
  };

  const handleConfirmOpenChange = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) {
      setConfirmMode(null);
      setConfirmTarget(null);
      setConfirmLoading(false);
    }
  };

  const handleConfirm = useCallback(async () => {
    if (!confirmTarget || !confirmMode) return;
    if (!aliveRef.current) return;
    setConfirmLoading(true);
    setActioning(confirmTarget.id);
    try {
      if (confirmMode === "activate") {
        // Optimistic update: flip status locally first.
        if (state.status === "ready") {
          previousItemsRef.current = state.items;
          const current = state.items.find((o) => o.id === confirmTarget.id);
          if (current) {
            upsert({ ...current, status: "ACTIVE" });
          }
        }
        const updated = await approveOrganization(confirmTarget.id);
        if (aliveRef.current) {
          upsert(updated);
        }
        showToastOnce("Organizace schválena.", { type: "success" });
      } else {
        if (state.status === "ready") {
          previousItemsRef.current = state.items;
          const current = state.items.find((o) => o.id === confirmTarget.id);
          if (current) {
            upsert({ ...current, status: "SUSPENDED" });
          }
        }
        const updated = await suspendOrganization(confirmTarget.id);
        if (aliveRef.current) {
          upsert(updated);
        }
        showToastOnce("Organizace pozastavena.", { type: "success" });
      }
      if (aliveRef.current) {
        setConfirmOpen(false);
        setConfirmMode(null);
        setConfirmTarget(null);
      }
    } catch (err) {
      if (previousItemsRef.current) {
        setAll(previousItemsRef.current);
        previousItemsRef.current = null;
      }
      showHttpErrorToastOnce(err);
    } finally {
      if (aliveRef.current) {
        setConfirmLoading(false);
        setActioning(null);
      }
    }
  }, [confirmMode, confirmTarget, state, upsert, setAll]);

  const handleReactivate = async (id: string) => {
    setActioning(id);
    if (state.status === "ready") {
      previousItemsRef.current = state.items;
      const current = state.items.find((o) => o.id === id);
      if (current) {
        // Optimistically assume successful reactivate to ACTIVE; server response wins later.
        upsert({ ...current, status: "ACTIVE" });
      }
    }
    try {
      const updated = await reactivateOrganization(id);
      if (aliveRef.current) {
        upsert(updated);
      }
      showToastOnce("Organizace reaktivována.", { type: "success" });
    } catch (err) {
      if (previousItemsRef.current) {
        setAll(previousItemsRef.current);
        previousItemsRef.current = null;
      }
      showHttpErrorToastOnce(err);
    } finally {
      if (aliveRef.current) {
        setActioning(null);
      }
    }
  };

  // Filter only; order is always the backend order (never changed on frontend).
  const items =
    state.status === "ready" || state.status === "refreshing" ? state.items : [];
  const filteredItems = items.filter(
    (o) => statusFilter === "all" || o.status === statusFilter
  );

  const isInitialLoading = state.status === "initial-loading";
  const emptyList =
    (state.status === "ready" || state.status === "refreshing") &&
    items.length === 0;
  const emptyFiltered =
    (state.status === "ready" || state.status === "refreshing") &&
    filteredItems.length === 0 &&
    items.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">
        Platforma – organizace
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Hledat (název, email…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/50 p-1">
          {(
            [
              { value: "all" as const, label: "Vše" },
              { value: "PENDING" as const, label: "Čeká na schválení" },
              { value: "ACTIVE" as const, label: "Aktivní" },
              { value: "SUSPENDED" as const, label: "Pozastavené" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={
                statusFilter === value
                  ? "rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm"
                  : "rounded px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              }
            >
              {label}
            </button>
          ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            aria-label="Obnovit seznam organizací"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Obnovuji…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Obnovit data
              </>
            )}
          </Button>
        </div>
        {lastUpdatedAt && (
          <p className="text-xs text-slate-500">
            Poslední aktualizace:{" "}
            {lastUpdatedAt.toLocaleTimeString("cs-CZ", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="cursor-not-allowed opacity-70"
                aria-disabled
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Vytvořit organizaci
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px]">
            Organizace se zakládají výhradně přes onboarding uživatele.
          </TooltipContent>
        </Tooltip>
      </div>

      {isInitialLoading ? (
        <Card className="overflow-hidden border-slate-200">
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`org-skel-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : state.status === "error" ? (
        <Card className="flex min-h-[200px] flex-col items-center justify-center gap-3 border-slate-200 px-6 py-8">
          <p className="text-sm text-slate-600">
            Organizace se nepodařilo načíst.
          </p>
          <Button size="sm" variant="outline" onClick={() => void handleRefresh()}>
            Zkusit znovu
          </Button>
        </Card>
      ) : emptyList ? (
        /* Empty state: žádné CTA, pouze informace */
        <Card className="flex min-h-[220px] flex-col items-center justify-center border-slate-200 bg-slate-50/50 px-6 py-12">
          <Building2 className="h-12 w-12 text-slate-400" aria-hidden />
          <p className="mt-4 text-sm font-medium text-slate-700">
            Zatím neexistují žádné organizace.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Jakmile uživatel projde onboardingem, organizace se zde automaticky
            zobrazí.
          </p>
        </Card>
      ) : emptyFiltered ? (
        <Card className="flex min-h-[160px] items-center justify-center border-slate-200 px-6 py-8">
          <p className="text-sm text-slate-600">
            Žádné organizace neodpovídají zvolenému filtru.
          </p>
        </Card>
      ) : state.status === "ready" || state.status === "refreshing" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-left">Název</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Vytvořeno</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Readiness</th>
                  <th className="px-4 py-3 text-left">Čísla</th>
                  <th className="px-4 py-3 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((o) => {
                  const days = o.status === "PENDING" ? daysSince(o.createdAt) : 0;
                  return (
                  <tr
                    key={o.id}
                    className={
                      o.status === "PENDING"
                        ? "border-b last:border-0 bg-amber-50/30"
                        : "border-b last:border-0"
                    }
                  >
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">
                      {o.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge variant="neutral">{o.status}</Badge>
                          <span className="text-xs text-amber-700">
                            Čeká {days} {days === 1 ? "den" : days < 5 ? "dny" : "dní"}
                          </span>
                        </span>
                      ) : (
                        <Badge
                          variant={
                            o.status === "ACTIVE"
                              ? "success"
                              : o.status === "SUSPENDED"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {o.status}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(o.createdAt).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.ownerEmail ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          (o.hasCurrentAcademicYear ?? o.hasActiveAcademicYear) &&
                          (o.hasAnyClassSectionInCurrentYear ?? o.hasAnyClassSectionInActiveYear)
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }
                      >
                        {(o.hasCurrentAcademicYear ?? o.hasActiveAcademicYear) &&
                        (o.hasAnyClassSectionInCurrentYear ?? o.hasAnyClassSectionInActiveYear)
                          ? "Připravena"
                          : "Nepřipravena"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.membershipsCount} členů · {o.studentsCount} žáků ·{" "}
                      {o.classroomsCount} tříd
                    </td>
                    <td className="px-4 py-3">
                      {o.status === "PENDING" && isSuperAdmin ? (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={!!actioning}
                          onClick={() => openConfirm("activate", o)}
                        >
                          {actioning === o.id ? "…" : "Schválit"}
                        </Button>
                      ) : o.status === "SUSPENDED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!actioning}
                          onClick={() => void handleReactivate(o.id)}
                        >
                          {actioning === o.id ? "…" : "Reaktivovat"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!actioning}
                          onClick={() => openConfirm("suspend", o)}
                        >
                          {actioning === o.id ? "…" : "Pozastavit"}
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && meta.pages > 1 && (
            <div className="border-t px-4 py-2 text-slate-600">
              Stránka {meta.page} / {meta.pages} · Celkem {meta.total}{" "}
              organizací
            </div>
          )}
        </Card>
      ) : (
        <p className="text-slate-600">Organizace se nepodařilo načíst.</p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleConfirmOpenChange}
        title={
          confirmMode === "activate" && confirmTarget
            ? `Schválit organizaci „${confirmTarget.name}“?`
            : confirmMode === "suspend" && confirmTarget
              ? `Pozastavit organizaci „${confirmTarget.name}“?`
              : "Potvrdit akci"
        }
        description={
          confirmMode === "activate"
            ? "Změní se status z PENDING na ACTIVE. Vlastník organizace bude moci pokračovat do dashboardu."
            : confirmMode === "suspend"
              ? "Členové nebudou moci používat core funkce organizace."
              : undefined
        }
        confirmText={confirmMode === "suspend" ? "Pozastavit" : "Schválit"}
        loadingText={confirmMode === "suspend" ? "Pozastavuji…" : "Schvaluji…"}
        cancelText="Zrušit"
        destructive={confirmMode === "suspend"}
        loading={confirmLoading}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
