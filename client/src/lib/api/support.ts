import { httpClient } from "@/lib/http/client";
import type { AdminSupportTicket, SupportTicket } from "@/types";

export type CreateSupportTicketInput = {
  category: string;
  message: string;
  page?: string;
  metadata?: Record<string, unknown>;
};

export const createSupportTicket = (input: CreateSupportTicketInput) =>
  httpClient.post<SupportTicket, CreateSupportTicketInput>("/support/tickets", input);

export const getMySupportTickets = () =>
  httpClient.get<SupportTicket[]>("/support/my-tickets", { cache: "no-store" });

export const getOpenSupportTickets = () =>
  httpClient.get<AdminSupportTicket[]>("/admin/support/tickets", { cache: "no-store" });

export const resolveSupportTicket = (id: string) =>
  httpClient.patch<AdminSupportTicket, { status: "RESOLVED" }>(
    `/admin/support/tickets/${id}/resolve`,
    { status: "RESOLVED" },
  );
