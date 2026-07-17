"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpClient } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditLog = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  systemRole: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  // ipAddress and userAgent are always null for org roles (redacted by backend)
  createdAt: string;
};

type AuditMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type AuditLogsResponse = {
  items: AuditLog[];
  meta: AuditMeta;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type Filters = {
  entityType: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = {
  entityType: "",
  action: "",
  dateFrom: "",
  dateTo: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncate(s: string | null | undefined, max = 28): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrgAuditPage(): React.JSX.Element {
  const { user } = useAuth();
  const orgRole = user?.organizationRole;
  const canAccess = orgRole === "DIRECTOR" || orgRole === "OWNER";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [committed, setCommitted] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aliveRef = useRef(true);
  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number | boolean | undefined> = { page: p, limit: 50 };
      if (f.entityType.trim()) query.entityType = f.entityType.trim();
      if (f.action.trim()) query.action = f.action.trim();
      if (f.dateFrom) query.dateFrom = f.dateFrom;
      if (f.dateTo) query.dateTo = f.dateTo;

      const data = await httpClient.get<AuditLogsResponse>("/audit/logs", { query });
      if (!aliveRef.current) return;
      setItems(data.items);
      setMeta(data.meta);
    } catch (err) {
      if (!aliveRef.current) return;
      showHttpErrorToastOnce(err);
      setError("Audit logy se nepodařilo načíst.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  // Load on mount only if user has access
  useEffect(() => {
    if (canAccess) {
      void load(EMPTY_FILTERS, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleSearch = () => {
    setCommitted(filters);
    setPage(1);
    void load(filters, 1);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setCommitted(EMPTY_FILTERS);
    setPage(1);
    void load(EMPTY_FILTERS, 1);
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    void load(committed, next);
  };

  // Guard: only DIRECTOR/OWNER
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShieldAlert className="h-10 w-10 text-slate-400" />
        <p className="text-base font-medium text-slate-700">Přístup odepřen</p>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Audit log organizace je dostupný pouze pro role DIRECTOR a OWNER.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-slate-600" />
        <h1 className="text-xl font-semibold text-slate-900">Audit log organizace</h1>
      </div>

      <p className="text-sm text-slate-500">
        Záznamy jsou automaticky omezeny na vaši organizaci. IP adresa a user agent
        nejsou z důvodu ochrany soukromí zobrazovány.
      </p>

      {/* Filter bar */}
      <Card className="border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Typ entity (USER, TEST…)"
            value={filters.entityType}
            onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          />
          <Input
            placeholder="Akce (obsahuje)"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          />
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            aria-label="Datum od"
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            aria-label="Datum do"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Načítám…
              </>
            ) : (
              "Vyhledat"
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={loading}>
            Resetovat
          </Button>
          {meta && (
            <span className="ml-auto text-xs text-slate-500">
              Celkem {meta.total} záznamů
            </span>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-slate-200">
        {/* Column header */}
        <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[160px_1fr_1fr_1fr] gap-3">
          <span>Čas</span>
          <span>Akce</span>
          <span>Entita</span>
          <span>Uživatel</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`aud-skel-${i}`} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-slate-600">{error}</p>
            <Button size="sm" variant="outline" onClick={handleSearch}>
              Zkusit znovu
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <ScrollText className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Žádné záznamy pro zadané filtry.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[160px_1fr_1fr_1fr] sm:items-center"
              >
                {/* Timestamp */}
                <span className="font-mono text-xs text-slate-500">
                  {formatTs(log.createdAt)}
                </span>

                {/* Action */}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                  {log.action}
                </span>

                {/* Entity */}
                <div>
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {log.entityType}
                  </span>
                  <span className="ml-1.5 font-mono text-xs text-slate-400">
                    {truncate(log.entityId, 12)}
                  </span>
                </div>

                {/* Actor */}
                <span className="font-mono text-xs text-slate-500">
                  {truncate(log.userId, 24)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
            <span className="text-xs text-slate-500">
              Stránka {meta.page} / {meta.pages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="h-7 w-7 p-0"
                aria-label="Předchozí stránka"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.pages || loading}
                onClick={() => handlePageChange(page + 1)}
                className="h-7 w-7 p-0"
                aria-label="Další stránka"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
