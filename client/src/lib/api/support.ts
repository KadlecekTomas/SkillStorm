import { httpClient } from "@/lib/http/client";
import type {
  AdminSupportTicket,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types";

export type CreateSupportTicketInput = {
  category: string;
  message: string;
  page?: string;
  metadata?: Record<string, unknown>;
  priority?: SupportTicketPriority;
};

export type SupportInboxFilters = {
  status?: SupportTicketStatus | "all";
  organizationId?: string;
  category?: string | "all";
};

export type UpdateSupportTicketInput = {
  assignedToId?: string | null;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  internalNote?: string | null;
  resolutionNote?: string | null;
};

export const createSupportTicket = (
  input: CreateSupportTicketInput,
): Promise<SupportTicket> =>
  httpClient.post<SupportTicket, CreateSupportTicketInput>("/support/tickets", input);

export const getMySupportTickets = (): Promise<SupportTicket[]> =>
  httpClient.get<SupportTicket[]>("/support/my-tickets", { cache: "no-store" });

export const getSupportInboxTickets = (
  filters: SupportInboxFilters = {},
): Promise<AdminSupportTicket[]> =>
  httpClient.get<AdminSupportTicket[]>("/platform/support/tickets", {
    cache: "no-store",
    query: {
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
      ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
    },
  });

export const getSupportTicketDetail = (id: string): Promise<AdminSupportTicket> =>
  httpClient.get<AdminSupportTicket>(`/platform/support/tickets/${id}`, {
    cache: "no-store",
  });

export const updateSupportTicket = (
  id: string,
  input: UpdateSupportTicketInput,
): Promise<AdminSupportTicket> =>
  httpClient.patch<AdminSupportTicket, UpdateSupportTicketInput>(
    `/platform/support/tickets/${id}`,
    input,
  );
