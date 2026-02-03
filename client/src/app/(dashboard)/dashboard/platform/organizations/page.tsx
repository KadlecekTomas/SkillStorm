"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { showToastOnce } from "@/utils/toast";
import { HttpError } from "@/lib/http/client";

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

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const isPlatformAdmin = user?.isPlatformAdmin === true;

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [authLoading, isPlatformAdmin, router]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    const opts: Record<string, string> = {};
    if (search.trim()) opts.q = search.trim();
    fetchWithAuth<ListResponse>("GET", "/platform/organizations", {
      query: opts,
    })
      .then((res) => setData(res ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, search]);

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
      showToastOnce(
        err instanceof HttpError ? String(err.message) : "Akce se nezdařila.",
        { type: "error" }
      );
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
      showToastOnce(
        err instanceof HttpError ? String(err.message) : "Akce se nezdařila.",
        { type: "error" }
      );
    } finally {
      setActioning(null);
    }
  };

  if (!isPlatformAdmin || authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Načítám…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Platforma – organizace
      </h1>
      <div className="flex items-center gap-4">
        <Input
          placeholder="Hledat (název, email…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner label="Načítám organizace…" />
        </div>
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
                {data.items.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">
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
                      {o.status === "SUSPENDED" ? (
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
                ))}
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
