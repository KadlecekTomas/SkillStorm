"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySupportTickets } from "@/lib/api/support";
import type { SupportTicket } from "@/types";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { withGuard } from "@/lib/guard/withGuard";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: SupportTicket["status"]): string {
  if (status === "RESOLVED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "IN_REVIEW") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function SupportMyTicketsPage(): React.JSX.Element {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMySupportTickets();
      setTickets(data);
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Moje nahlášené problémy</h1>
            <p className="text-sm text-slate-500">
              Stav ticketů, které jste poslali do platform support inboxu.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Obnovit
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[160px_1fr_120px_180px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
          <span>Kategorie</span>
          <span>Popis</span>
          <span>Stav</span>
          <span>Aktualizováno</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`my-ticket-${index}`} className="h-24 bg-slate-100" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            Zatím jste neposlali žádné support hlášení.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr_120px_180px]">
                <div>
                  <p className="font-medium text-slate-900">{ticket.category}</p>
                  <p className="text-xs text-slate-500">{ticket.priority}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">{ticket.message}</p>
                  {ticket.resolutionNote ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {ticket.resolutionNote}
                    </div>
                  ) : null}
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  <p>Vytvořeno: {formatDate(ticket.createdAt)}</p>
                  <p>Aktualizováno: {formatDate(ticket.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default withGuard({
  requireRoles: ["OWNER", "DIRECTOR", "TEACHER"],
  requireSchoolWorkspace: true,
})(SupportMyTicketsPage);
