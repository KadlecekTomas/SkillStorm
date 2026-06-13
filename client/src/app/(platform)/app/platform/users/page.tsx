"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpClient } from "@/lib/http/client";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformUser = {
  id: string;
  name: string;
  email: string | null;
  systemRole: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type UsersResponse = {
  items: PlatformUser[];
  meta: { total: number; page: number; limit: number };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SystemRoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-gray-400">—</span>;
  const cls =
    role === "SUPERADMIN"
      ? "bg-amber-100 text-amber-700"
      : role === "DEVOPS"
        ? "bg-blue-50 text-blue-700"
        : role === "SUPPORT"
          ? "bg-violet-50 text-violet-700"
          : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "SUSPENDED"
        ? "bg-red-50 text-red-600"
        : "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${cls}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const LIMIT = 20;

export default function PlatformUsersPage(): React.JSX.Element {
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<PlatformUser[]>([]);
  const [meta, setMeta] = useState<UsersResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const aliveRef = useRef(true);
  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Debounce raw search → committed search (400 ms), reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchRaw);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true);
    setError(false);
    try {
      const query: Record<string, string | number> = { page: p, limit: LIMIT };
      if (s) query.search = s;
      const data = await httpClient.get<UsersResponse>("/platform/users", {
        query,
      });
      if (!aliveRef.current) return;
      setItems(data.items);
      setMeta(data.meta);
    } catch (err) {
      if (!aliveRef.current) return;
      showHttpErrorToastOnce(err);
      setError(true);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(search, page);
  }, [load, search, page]);

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / LIMIT)) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Global Users</h1>
          {meta && (
            <p className="mt-0.5 text-xs text-gray-400">
              {meta.total} {meta.total === 1 ? "uživatel" : "uživatelů"} celkem
            </p>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Hledat podle jména nebo e-mailu…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="w-72 pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Column header */}
        <div className="border-b border-gray-200 px-5 py-3">
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 text-xs font-medium uppercase tracking-wide text-gray-400">
            <span>Name</span>
            <span>Email</span>
            <span>System Role</span>
            <span>Status</span>
            <span>Created</span>
            <span>Last Login</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`usr-skel-${i}`} className="h-10 w-full bg-gray-200" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <p className="text-sm text-gray-500">Uživatele se nepodařilo načíst.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load(search, page)}
            >
              Zkusit znovu
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20">
            <p className="text-sm text-gray-500">
              {search
                ? "Žádní uživatelé neodpovídají hledání."
                : "Žádní uživatelé."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] items-center gap-4 px-5 py-3 text-sm"
              >
                <span className="truncate font-medium text-gray-800">
                  {u.name || "—"}
                </span>
                <span className="truncate font-mono text-xs text-gray-600">
                  {u.email ?? "—"}
                </span>
                <span>
                  <SystemRoleBadge role={u.systemRole} />
                </span>
                <span>
                  <StatusBadge status={u.status} />
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(u.createdAt)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(u.lastLoginAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-2.5">
            <span className="text-xs text-gray-500">
              Stránka {page} / {totalPages} · celkem {meta?.total ?? 0}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 w-7 p-0"
                aria-label="Předchozí stránka"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
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
