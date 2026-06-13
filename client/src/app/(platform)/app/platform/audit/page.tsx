"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpClient } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { RefreshCw, ScrollText, Shield, ChevronLeft, ChevronRight } from "lucide-react";

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
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
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
  organizationId: string;
  entityType: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = {
  organizationId: "",
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

function truncate(s: string | null | undefined, max = 32): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ---------------------------------------------------------------------------
// Cell components
// ---------------------------------------------------------------------------

function ActionBadge({ action }: { action: string }) {
  const isPlatformMutation = action.startsWith("PLATFORM_MUTATION:");
  const isAnonymized = action.includes("ANONYMIZED");
  const cls = isPlatformMutation
    ? "bg-violet-50 text-violet-700"
    : isAnonymized
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${cls}`}>
      {action}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlatformAuditPage(): React.JSX.Element {
  const { user } = useAuth();
  const isSuperAdmin = user?.systemRole === "SUPERADMIN";

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

  const load = useCallback(
    async (f: Filters, p: number) => {
      setLoading(true);
      setError(null);
      try {
        const query: Record<string, string | number | boolean | undefined> = { page: p, limit: 50 };
        if (f.organizationId.trim()) query.organizationId = f.organizationId.trim();
        if (f.entityType.trim()) query.entityType = f.entityType.trim();
        if (f.action.trim()) query.action = f.action.trim();
        if (f.dateFrom) query.dateFrom = f.dateFrom;
        if (f.dateTo) query.dateTo = f.dateTo;

        const data = await httpClient.get<AuditLogsResponse>("/platform/audit/logs", { query });
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
    },
    [],
  );

  useEffect(() => {
    void load(EMPTY_FILTERS, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Shield className="h-5 w-5 text-violet-600" />
        <h1 className="text-lg font-semibold text-gray-900">Audit log platformy</h1>
        {!isSuperAdmin && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            IP adresa skryta
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Input
            placeholder="Org ID (volitelné)"
            value={filters.organizationId}
            onChange={(e) => setFilters((f) => ({ ...f, organizationId: e.target.value }))}
          />
          <Input
            placeholder="Entity type (USER, TEST…)"
            value={filters.entityType}
            onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          />
          <Input
            placeholder="Akce (contains)"
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
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={loading}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
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
            <span className="ml-auto text-xs text-gray-500">
              Celkem {meta.total} záznamů
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Column header */}
        <div className="hidden border-b border-gray-200 px-4 py-2.5 lg:grid lg:grid-cols-[160px_1fr_1fr_1fr_120px_1fr] gap-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          <span>Čas</span>
          <span>Uživatel / Role</span>
          <span>Akce</span>
          <span>Entita</span>
          <span>Organizace</span>
          <span>IP adresa</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`aud-skel-${i}`} className="h-9 w-full bg-gray-200" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <p className="text-sm text-gray-500">{error}</p>
            <Button size="sm" variant="outline" onClick={handleSearch}>
              Zkusit znovu
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <ScrollText className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">Žádné záznamy pro zadané filtry.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 text-sm lg:grid-cols-[160px_1fr_1fr_1fr_120px_1fr] lg:items-center"
              >
                {/* Timestamp */}
                <span className="font-mono text-xs text-gray-400">
                  {formatTs(log.createdAt)}
                </span>

                {/* Actor */}
                <div>
                  <span className="block text-xs text-gray-600">
                    {truncate(log.userId, 24)}
                  </span>
                  {log.systemRole && (
                    <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700">
                      {log.systemRole}
                    </span>
                  )}
                </div>

                {/* Action */}
                <div>
                  <ActionBadge action={log.action} />
                </div>

                {/* Entity */}
                <div>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                    {log.entityType}
                  </span>
                  <span className="ml-1.5 font-mono text-xs text-gray-400">
                    {truncate(log.entityId, 12)}
                  </span>
                </div>

                {/* Org */}
                <span className="font-mono text-xs text-gray-400">
                  {truncate(log.organizationId, 10)}
                </span>

                {/* IP */}
                <span className="font-mono text-xs text-gray-600">
                  {log.ipAddress ?? <span className="italic text-gray-300">redacted</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5">
            <span className="text-xs text-gray-500">
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
      </div>
    </div>
  );
}
