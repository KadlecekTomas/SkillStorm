import { Injectable } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';

export type SupportScopedUser = {
  id: string;
  name: string;
  email: string | null;
};

export type SupportScopedMetadata = {
  page?: string | null;
  routePathname?: string | null;
  queryString?: string | null;
  componentContext?: string | null;
  userAgent?: string | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  uiRole?: string | null;
  clientTimestamp?: string | null;
} | null;

export type SupportTicketInternalDto = {
  id: string;
  organizationId: string;
  category: string;
  message: string;
  page: string | null;
  metadata: SupportScopedMetadata;
  status: string;
  priority: string;
  internalNote: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
  };
  user: SupportScopedUser;
  assignedTo: SupportScopedUser | null;
  resolvedBy: SupportScopedUser | null;
};

@Injectable()
export class SupportDataScopeService {
  private isSuperAdmin(user: JwtPayload): boolean {
    return user.systemRole === SystemRole.SUPERADMIN;
  }

  private redactUser(user: SupportScopedUser | null): SupportScopedUser | null {
    if (!user) return null;
    return {
      ...user,
      email: null,
    };
  }

  private redactMetadata(
    metadata: SupportScopedMetadata,
  ): SupportScopedMetadata {
    if (!metadata) return null;
    return {
      ...metadata,
      userAgent: null,
    };
  }

  scopeTicket(
    user: JwtPayload,
    ticket: SupportTicketInternalDto,
  ): SupportTicketInternalDto {
    if (this.isSuperAdmin(user)) {
      return ticket;
    }

    return {
      ...ticket,
      metadata: this.redactMetadata(ticket.metadata),
      user: this.redactUser(ticket.user) ?? {
        id: ticket.user.id,
        name: ticket.user.name,
        email: null,
      },
      assignedTo: this.redactUser(ticket.assignedTo),
      resolvedBy: this.redactUser(ticket.resolvedBy),
    };
  }

  scopeTicketList(
    user: JwtPayload,
    tickets: SupportTicketInternalDto[],
  ): SupportTicketInternalDto[] {
    return tickets.map((ticket) => this.scopeTicket(user, ticket));
  }
}
