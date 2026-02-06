"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ENTRY, isPlatformAdmin } from "@/utils/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";
import { Building2, Lock, RefreshCw } from "lucide-react";

type OrgItem = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  ownerEmail: string | null;
  membershipsCount: number;
  studentsCount: number;
  classroomsCount: number;
  hasActiveAcademicYear: boolean;
  hasAnyClassSectionInActiveYear: boolean;
};

type ListResponse = {
  items: OrgItem[];
  meta: { page: number; limit: number; total: number; pages: number };
};

type StatusFilter = "all" | "PENDING" | "ACTIVE" | "SUSPENDED";

function daysSince(dateStr: string): number {
  const created = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (24 * 60 * 60 * 1000));
}

/**
 * Auth invariant: logout is a hard boundary. No protected component may render after logout.
 */
export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, context, user, isLoggingOut } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const canAccessPlatform = context?.mode === "platform";
  const isSuperAdmin = isPlatformAdmin(user);

  if (isLoggingOut) return null;
  // 1. Auth not yet decided → spinner (never stuck: bootstrap always completes)
  if (!isHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji oprávnění…" />
      </div>
    );
  }

  // 2. Not authenticated → redirect to login
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  // 3. Authenticated but not platform admin → redirect to dashboard
  if (context?.mode !== "platform") {
    router.replace(DASHBOARD_ENTRY);
    return null;
  }

  // 4. OK – render platform page

  const fetchList = useCallback((): Promise<boolean> => {
    if (!canAccessPlatform) return Promise.resolve(false);
    setLoading(true);
    const opts: Record<string, string> = {};
    if (search.trim()) opts.q = search.trim();
    return fetchWithAuth<ListResponse>("GET", "/platform/organizations", {
      query: opts,
    })
      .then((res) => {
        setData(res ?? null);
        return !!res;
      })
      .catch(() => {
        setData(null);
        return false;
      })
      .finally(() => setLoading(false));
  }, [canAccessPlatform, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Explicit manual refresh:
  // Admin controls when data are reloaded.
  // Avoids polling, race conditions and unnecessary backend load.
  const handleRefresh = useCallback(async () => {
    const success = await fetchList();
    if (success) {
      setLastUpdatedAt(new Date());
      showToastOnce("Data byla obnovena.", { type: "info" });
    }
  }, [fetchList]);

  const handleSuspend = async (id: string) => {
    setActioning(id);
    try {
      await fetchWithAuth("POST", `/platform/organizations/${id}/suspend`);
      showToastOnce("Organizace pozastavena.", { type: "success" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((o) =>
                o.id === id ? { ...o, status: "SUSPENDED" } : o
              ),
            }
          : null
      );
    } catch (err) {
      showHttpErrorToastOnce(err);
    } finally {
      setActioning(null);
    }
  };

  const handleActivate = async (id: string, name: string) => {
    if (
      !confirm(
        `Schválit organizaci „${name}"? Status se změní z PENDING na ACTIVE a vlastník bude moci dokončit nastavení školy.`
      )
    ) {
      return;
    }
    setActioning(id);
    try {
      await fetchWithAuth("POST", `/platform/organizations/${id}/activate`);
      showToastOnce("Organizace schválena.", { type: "success" });
      fetchList();
    } catch (err) {
      showHttpErrorToastOnce(err);
    } finally {
      setActioning(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setActioning(id);
    try {
      await fetchWithAuth("POST", `/platform/organizations/${id}/reactivate`);
      showToastOnce("Organizace reaktivována.", { type: "success" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((o) =>
                o.id === id ? { ...o, status: "ACTIVE" } : o
              ),
            }
          : null
      );
    } catch (err) {
      showHttpErrorToastOnce(err);
    } finally {
      setActioning(null);
    }
  };

  // Filter only; order is always the backend order (never changed on frontend).
  const filteredItems =
    data?.items.filter(
      (o) => statusFilter === "all" || o.status === statusFilter
    ) ?? [];

  const emptyList = !loading && data && data.items.length === 0;
  const emptyFiltered = !loading && data && filteredItems.length === 0 && data.items.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Platforma – organizace
      </h1>

      {/* Informační panel: jak vznikají organizace (governance, bez error tónu) */}
      <Card className="border-slate-200 bg-slate-50/80 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-700">
          Jak vznikají organizace?
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Organizace ve SkillStorm vznikají výhradně během onboarding procesu
          nového uživatele. Tento proces zajišťuje správné přiřazení vlastníka,
          auditní stopu a konzistenci dat.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Platforma slouží ke správě a dohledu nad existujícími organizacemi.
        </p>
      </Card>

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
            disabled={loading}
            onClick={() => void handleRefresh()}
            aria-label="Obnovit seznam organizací"
          >
            {loading ? (
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

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner label="Načítám organizace…" />
        </div>
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
      ) : data ? (
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
                          o.hasActiveAcademicYear && o.hasAnyClassSectionInActiveYear
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }
                      >
                        {o.hasActiveAcademicYear && o.hasAnyClassSectionInActiveYear
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
                          onClick={() => void handleActivate(o.id, o.name)}
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
                          onClick={() => {
                            if (
                              confirm(
                                `Pozastavit organizaci „${o.name}“? Členové nebudou moci používat core funkce.`
                              )
                            ) {
                              void handleSuspend(o.id);
                            }
                          }}
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
          {data.meta.pages > 1 && (
            <div className="border-t px-4 py-2 text-slate-600">
              Stránka {data.meta.page} / {data.meta.pages} · Celkem {data.meta.total}{" "}
              organizací
            </div>
          )}
        </Card>
      ) : (
        <p className="text-slate-600">Organizace se nepodařilo načíst.</p>
      )}
    </div>
  );
}
