"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSupportInboxTickets,
  getSupportTicketDetail,
  updateSupportTicket,
} from "@/lib/api/support";
import type {
  AdminSupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { canTriageSupport } from "@/utils/permissions";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Otevřený",
  IN_REVIEW: "V řešení",
  RESOLVED: "Vyřešený",
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Nízká",
  MEDIUM: "Střední",
  HIGH: "Vysoká",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ticketCountLabel(count: number): string {
  if (count === 1) return "1 požadavek";
  if (count >= 2 && count <= 4) return `${count} požadavky`;
  return `${count} požadavků`;
}

function statusBadgeClass(status: SupportTicketStatus): string {
  if (status === "RESOLVED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "IN_REVIEW") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function priorityBadgeClass(priority: SupportTicketPriority): string {
  if (priority === "HIGH") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "LOW") return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function readRoute(ticket: AdminSupportTicket): string {
  const metadata = ticket.metadata;
  const route = metadata?.routePathname ?? ticket.page ?? "—";
  const query = metadata?.queryString ?? "";
  return `${route}${query}`;
}

export default function PlatformSupportPage(): React.JSX.Element {
  const { user } = useAuth();
  const triageAllowed = canTriageSupport(user);
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "all">("all");
  const [organizationFilter, setOrganizationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [internalNote, setInternalNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSupportInboxTickets();
      setTickets(data);
      if (data.length > 0) {
        const nextId = selectedId && data.some((ticket) => ticket.id === selectedId)
          ? selectedId
          : data[0]?.id ?? null;
        setSelectedId(nextId);
      } else {
        setSelectedId(null);
        setSelected(null);
      }
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await getSupportTicketDetail(id);
      setSelected(detail);
      setInternalNote(detail.internalNote ?? "");
      setResolutionNote(detail.resolutionNote ?? "");
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const organizations = useMemo(
    () =>
      Array.from(
        new Map(tickets.map((ticket) => [ticket.organizationId, ticket.organization.name])).entries(),
      ),
    [tickets],
  );

  const categories = useMemo(
    () => Array.from(new Set(tickets.map((ticket) => ticket.category))).sort(),
    [tickets],
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
        if (organizationFilter !== "all" && ticket.organizationId !== organizationFilter) return false;
        if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
        return true;
      }),
    [tickets, statusFilter, organizationFilter, categoryFilter],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredTickets.some((ticket) => ticket.id === selectedId)) {
      const nextId = filteredTickets[0]?.id ?? null;
      setSelectedId(nextId);
      if (!nextId) {
        setSelected(null);
      }
    }
  }, [filteredTickets, selectedId]);

  const handleUpdate = async (payload: {
    assignedToId?: string | null;
    status?: SupportTicketStatus;
    internalNote?: string | null;
    resolutionNote?: string | null;
  }) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updated = await updateSupportTicket(selectedId, payload);
      setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
      setSelected(updated);
      setInternalNote(updated.internalNote ?? "");
      setResolutionNote(updated.resolutionNote ?? "");
      showToastOnce("Požadavek byl aktualizován.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setSaving(false);
    }
  };

  const currentAssigneeName =
    selected?.assignedTo?.name ??
    (selected?.assignedTo?.id === user?.id ? "Přiřazeno vám" : "Nepřiřazeno");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Podpora požadavků</h1>
            <p className="text-sm text-slate-500">
              Požadavky uživatelů ze všech organizací na jednom místě.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadTickets()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Obnovit
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[180px_220px_180px_1fr]">
        <label className="space-y-1 text-sm text-slate-600">
          <span>Stav</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SupportTicketStatus | "all")}
          >
            <option value="all">Všechny stavy</option>
            <option value="OPEN">Otevřený</option>
            <option value="IN_REVIEW">V řešení</option>
            <option value="RESOLVED">Vyřešený</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-600">
          <span>Organizace</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={organizationFilter}
            onChange={(event) => setOrganizationFilter(event.target.value)}
          >
            <option value="all">Všechny organizace</option>
            {organizations.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-600">
          <span>Kategorie</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Všechny kategorie</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {ticketCountLabel(filteredTickets.length)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            Fronta požadavků
          </div>
          {loading ? (
            <div className="space-y-3 p-4" aria-label="Načítání požadavků podpory">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={`support-row-${index}`} className="h-24 bg-slate-100" />
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Žádné požadavky neodpovídají filtrům.</p>
                <p className="text-sm text-slate-500">Zkuste upravit filtry nebo seznam obnovit.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredTickets.map((ticket) => {
                const active = ticket.id === selectedId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={`grid w-full gap-3 px-4 py-4 text-left transition-colors ${
                      active ? "bg-slate-50" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{ticket.organization.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(ticket.status)}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(ticket.priority)}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                    </div>
                    <div className="grid gap-1 text-sm text-slate-600 md:grid-cols-[160px_1fr_auto] md:items-start">
                      <div>
                        <p className="font-medium text-slate-800">{ticket.category}</p>
                        <p className="text-xs text-slate-500">{ticket.user.name}</p>
                      </div>
                      <p className="line-clamp-2">{ticket.message}</p>
                      <div className="text-xs text-slate-500 md:text-right">
                        <p>{formatDate(ticket.createdAt)}</p>
                        <p>{ticket.assignedTo?.name ?? "Nepřiřazeno"}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedId ? (
            <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500">
              Vyberte požadavek a zobrazí se jeho detail.
            </div>
          ) : detailLoading || !selected ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={`support-detail-${index}`} className="h-16 bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{selected.category}</h2>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(selected.status)}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(selected.priority)}`}>
                    {PRIORITY_LABELS[selected.priority]}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {selected.organization.name} · vytvořeno {formatDate(selected.createdAt)}
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nahlásil</p>
                  <p>{selected.user.name}</p>
                  <p className="text-xs text-slate-500">{selected.user.email ?? "Skryto"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trasa</p>
                  <p className="font-mono text-xs">{readRoute(selected)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Komponenta</p>
                  <p className="font-mono text-xs">{selected.metadata?.componentContext ?? "—"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rozlišení</p>
                    <p>
                      {selected.metadata?.viewportWidth && selected.metadata?.viewportHeight
                        ? `${selected.metadata.viewportWidth}×${selected.metadata.viewportHeight}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Přiřazeno</p>
                    <p>{currentAssigneeName}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Zpráva</p>
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </div>
                {selected.resolutionNote ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Řešení</p>
                    <p className="whitespace-pre-wrap">{selected.resolutionNote}</p>
                  </div>
                ) : null}
                {selected.internalNote ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Interní poznámka</p>
                    <p className="whitespace-pre-wrap">{selected.internalNote}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    href={`/app/platform/organizations/${selected.organizationId}`}
                    className="font-medium text-slate-700 underline hover:text-slate-900"
                  >
                    Otevřít organizaci
                  </Link>
                </div>
              </div>

              {triageAllowed ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Interní poznámka</label>
                    <textarea
                      className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      placeholder="Interní poznámka k řešení, viditelná pouze v administraci podpory."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void handleUpdate({ internalNote: internalNote.trim() || null })}
                    >
                      Uložit poznámku
                    </Button>
                  </div>

                  {selected.status !== "RESOLVED" ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving || selected.assignedTo?.id === user?.id}
                          onClick={() => void handleUpdate({ assignedToId: user?.id ?? null })}
                        >
                          <UserRoundCheck className="h-4 w-4" />
                          Přiřadit mně
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving || selected.status !== "OPEN"}
                          onClick={() => void handleUpdate({ status: "IN_REVIEW" })}
                        >
                          Přesunout do řešení
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Poznámka k vyřešení</label>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                          value={resolutionNote}
                          onChange={(event) => setResolutionNote(event.target.value)}
                          placeholder="Popište, co bylo opraveno nebo jak má uživatel dále postupovat."
                        />
                        <Button
                          type="button"
                          disabled={saving || resolutionNote.trim().length < 3}
                          onClick={() =>
                            void handleUpdate({
                              status: "RESOLVED",
                              resolutionNote: resolutionNote.trim(),
                            })
                          }
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Vyřešit požadavek
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Vyřešeno {selected.resolvedAt ? formatDate(selected.resolvedAt) : ""}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Pouze pro čtení. Pro zpracování požadavků je potřeba role SUPPORT nebo SUPERADMIN.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
