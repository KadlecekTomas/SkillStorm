"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpClient } from "@/lib/http/client";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function roleLabel(role: string): string {
  if (role === "SUPERADMIN") return "Superadmin";
  if (role === "DEVOPS") return "DevOps";
  if (role === "SUPPORT") return "Podpora";
  return role;
}

function statusLabel(status: string): string {
  if (status === "ACTIVE") return "Aktivní";
  if (status === "SUSPENDED") return "Pozastaven";
  return status;
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
      className={`inline-flex max-w-full rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {roleLabel(role)}
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
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function MobileUserCard({ user }: { user: PlatformUser }): React.JSX.Element {
  return (
    <article className="space-y-3 px-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{user.name || "—"}</p>
        <p className="mt-0.5 break-all font-mono text-xs text-gray-600">{user.email ?? "—"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SystemRoleBadge role={user.systemRole} />
        <StatusBadge status={user.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-gray-400">Vytvořen</dt>
          <dd className="mt-0.5 text-gray-600">{formatDate(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Poslední přihlášení</dt>
          <dd className="mt-0.5 text-gray-600">{formatDate(user.lastLoginAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

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
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

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
      const data = await httpClient.get<UsersResponse>("/platform/users", { query });
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
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Uživatelé</h1>
          {meta && (
            <p className="mt-0.5 text-xs text-gray-400">
              Celkem {meta.total}
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-72 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Hledat jméno nebo e-mail…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="w-full pl-8"
          />
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`usr-skel-${i}`} className="h-10 w-full bg-gray-200" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
            <p className="text-sm text-gray-500">Uživatele se nepodařilo načíst.</p>
            <Button size="sm" variant="outline" onClick={() => void load(search, page)}>
              Zkusit znovu
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-20 text-center">
            <p className="text-sm text-gray-500">
              {search ? "Žádní uživatelé neodpovídají hledání." : "Žádní uživatelé."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {items.map((user) => (
                <MobileUserCard key={user.id} user={user} />
              ))}
            </div>

            <div className="hidden min-w-0 md:block">
              <div className="border-b border-gray-200 px-5 py-3">
                <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <span>Jméno</span>
                  <span>E-mail</span>
                  <span>Systémová role</span>
                  <span>Stav</span>
                  <span>Vytvořen</span>
                  <span>Poslední přihlášení</span>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] items-center gap-4 px-5 py-3 text-sm"
                  >
                    <span className="truncate font-medium text-gray-800">{u.name || "—"}</span>
                    <span className="truncate font-mono text-xs text-gray-600">{u.email ?? "—"}</span>
                    <span><SystemRoleBadge role={u.systemRole} /></span>
                    <span><StatusBadge status={u.status} /></span>
                    <span className="text-xs text-gray-500">{formatDate(u.createdAt)}</span>
                    <span className="text-xs text-gray-500">{formatDate(u.lastLoginAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-2.5">
            <span className="text-xs text-gray-500">
              Strana {page} z {totalPages} · celkem {meta?.total ?? 0}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 w-9 p-0 sm:h-7 sm:w-7"
                aria-label="Předchozí stránka"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 w-9 p-0 sm:h-7 sm:w-7"
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
