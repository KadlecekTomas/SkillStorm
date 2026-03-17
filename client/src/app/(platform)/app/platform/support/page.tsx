"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, LifeBuoy, Loader2, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getOpenSupportTickets, resolveSupportTicket } from "@/lib/api/support";
import type { AdminSupportTicket, SupportTicketMetadata } from "@/types";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";

type TicketContext = SupportTicketMetadata;

function formatDate(value: string): string {
  return new Date(value).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readContext(metadata: AdminSupportTicket["metadata"]): TicketContext {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as TicketContext;
}

function buildRoute(ticket: AdminSupportTicket): string {
  const context = readContext(ticket.metadata);
  const pathname = context.routePathname ?? ticket.page ?? "";
  const query = context.queryString ?? "";
  return `${pathname}${query}`;
}

function formatViewport(ticket: AdminSupportTicket): string {
  const context = readContext(ticket.metadata);
  if (
    typeof context.viewportWidth === "number" &&
    typeof context.viewportHeight === "number"
  ) {
    return `${context.viewportWidth}×${context.viewportHeight}`;
  }
  return "—";
}

function formatBrowser(ticket: AdminSupportTicket): string {
  const context = readContext(ticket.metadata);
  if (!context.userAgent || typeof context.userAgent !== "string") {
    return "—";
  }
  return context.userAgent.length > 72
    ? `${context.userAgent.slice(0, 72)}…`
    : context.userAgent;
}

function ContextSummary({ ticket }: { ticket: AdminSupportTicket }) {
  const context = readContext(ticket.metadata);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Context
      </p>
      <div className="space-y-1 text-xs text-gray-600">
        <p>
          <span className="font-medium text-gray-700">Route:</span>{" "}
          <span className="font-mono">{buildRoute(ticket) || "—"}</span>
        </p>
        <p>
          <span className="font-medium text-gray-700">Component:</span>{" "}
          <span className="font-mono">{context.componentContext || "—"}</span>
        </p>
        <p>
          <span className="font-medium text-gray-700">Viewport:</span> {formatViewport(ticket)}
        </p>
        <p>
          <span className="font-medium text-gray-700">Browser:</span> {formatBrowser(ticket)}
        </p>
        <p>
          <span className="font-medium text-gray-700">Submitted by:</span> {ticket.user.name}
          {context.uiRole ? ` (${context.uiRole})` : ""}
        </p>
        <p>
          <span className="font-medium text-gray-700">Organization:</span> {ticket.organization.name}
        </p>
      </div>
    </div>
  );
}

export default function PlatformSupportPage(): React.JSX.Element {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOpenSupportTickets();
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

  const empty = useMemo(() => !loading && tickets.length === 0, [loading, tickets.length]);

  const handleResolve = async (ticket: AdminSupportTicket) => {
    setResolvingId(ticket.id);
    try {
      await resolveSupportTicket(ticket.id);
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      if (selected?.id === ticket.id) {
        setSelected(null);
      }
      showToastOnce("Support ticket resolved.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 text-amber-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Support requests</h1>
            <p className="text-sm text-gray-500">
              Lightweight operational inbox for school-reported issues.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_2fr_1.2fr_1fr_1fr] gap-3 border-b border-gray-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400 lg:grid">
          <span>Organization</span>
          <span>User</span>
          <span>Category</span>
          <span>Message</span>
          <span>Page</span>
          <span>Created</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`support-skeleton-${index}`} className="h-16 bg-gray-100" />
            ))}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">No open support tickets.</p>
              <p className="text-sm text-gray-500">The inbox is empty right now.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_1fr_0.8fr_2fr_1.2fr_1fr_1fr]">
                <div>
                  <p className="font-medium text-gray-900">{ticket.organization.name}</p>
                  <p className="text-xs text-gray-500">{ticket.organizationId}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{ticket.user.name}</p>
                  <p className="text-xs text-gray-500">{ticket.user.email ?? "—"}</p>
                </div>
                <div>
                  <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    {ticket.category}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="line-clamp-3 text-sm text-gray-700">{ticket.message}</p>
                  <ContextSummary ticket={ticket} />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelected(ticket)}>
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleResolve(ticket)}
                      disabled={resolvingId === ticket.id}
                    >
                      {resolvingId === ticket.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Resolving…
                        </>
                      ) : (
                        "Resolve"
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">{ticket.page ?? "—"}</div>
                <div className="text-sm text-gray-600">{formatDate(ticket.createdAt)}</div>
                <div className="flex items-start gap-2">
                  <span className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                    {ticket.status}
                  </span>
                  <Link
                    href={`/admin/organizations/${ticket.organizationId}`}
                    className="text-xs font-medium text-violet-700 hover:text-violet-900"
                  >
                    Open organization
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.category ?? "Support ticket"}</DialogTitle>
            <DialogDescription>
              {selected?.organization.name ?? "—"} · {selected?.user.name ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Page</p>
              <p className="font-mono">{selected ? buildRoute(selected) : "—"}</p>
            </div>
            {selected && <ContextSummary ticket={selected} />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message</p>
              <p className="whitespace-pre-wrap">{selected?.message ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created</p>
              <p>{selected ? formatDate(selected.createdAt) : "—"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && (
              <Button
                type="button"
                onClick={() => void handleResolve(selected)}
                disabled={resolvingId === selected.id}
              >
                {resolvingId === selected.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resolving…
                  </>
                ) : (
                  "Resolve"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
