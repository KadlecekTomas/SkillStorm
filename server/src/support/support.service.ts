import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
  SystemRole,
} from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { RequestWithUser } from '@/types/request-with-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import type { SupportTicketInternalDto } from './support-data-scope.service';

type TicketListFilters = {
  status?: SupportTicketStatus;
  organizationId?: string;
  category?: string;
};

type SupportOperatorRole = 'SUPERADMIN' | 'SUPPORT';

const PLATFORM_READ_ROLES = new Set<SystemRole>([
  SystemRole.SUPERADMIN,
  SystemRole.SUPPORT,
  SystemRole.DEVOPS,
]);

const SUPPORT_MUTATION_ROLES = new Set<SupportOperatorRole>([
  SystemRole.SUPERADMIN,
  SystemRole.SUPPORT,
]);

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async assertOrgMembership(user: JwtPayload) {
    if (!user.organizationId || !user.membershipId) {
      throw new BadRequestException('Aktivní organizace je povinná.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        id: user.membershipId,
        userId: user.userId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('Uživatel nepatří do aktivní organizace.');
    }

    return membership;
  }

  private assertPlatformReader(user: JwtPayload) {
    if (!user.systemRole || !PLATFORM_READ_ROLES.has(user.systemRole)) {
      throw new ForbiddenException(
        'Platform support inbox requires system role access.',
      );
    }
  }

  private assertSupportOperator(user: JwtPayload): SupportOperatorRole {
    if (
      !user.systemRole ||
      !SUPPORT_MUTATION_ROLES.has(user.systemRole as SupportOperatorRole)
    ) {
      throw new ForbiddenException(
        'Support triage actions require SUPPORT or SUPERADMIN.',
      );
    }
    return user.systemRole as SupportOperatorRole;
  }

  private resolvePage(
    dto: CreateTicketDto,
    req: RequestWithUser,
  ): string | null {
    const headerPage =
      req.headers['x-skillstorm-page'] ??
      req.headers['x-page-route'] ??
      req.headers.referer;
    const normalizedHeader =
      typeof headerPage === 'string' && headerPage.trim().length > 0
        ? headerPage.trim()
        : null;
    const normalizedDto =
      typeof dto.page === 'string' && dto.page.trim().length > 0
        ? dto.page.trim()
        : null;
    return normalizedDto ?? normalizedHeader;
  }

  private buildMetadata(
    dto: CreateTicketDto,
    req: RequestWithUser,
  ): Prisma.InputJsonValue | undefined {
    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      page: this.resolvePage(dto, req),
      userAgent: req.get('user-agent') ?? null,
    };

    return metadata as Prisma.InputJsonValue;
  }

  private mapTicket(ticket: {
    id: string;
    organizationId: string;
    category: string;
    message: string;
    page: string | null;
    metadata: Prisma.JsonValue | null;
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    internalNote: string | null;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    organization: { id: string; name: string };
    user: { id: string; name: string; email: string | null };
    assignedTo: { id: string; name: string; email: string | null } | null;
    resolvedBy: { id: string; name: string; email: string | null } | null;
  }): SupportTicketInternalDto {
    return {
      id: ticket.id,
      organizationId: ticket.organizationId,
      category: ticket.category,
      message: ticket.message,
      page: ticket.page,
      metadata:
        ticket.metadata &&
        typeof ticket.metadata === 'object' &&
        !Array.isArray(ticket.metadata)
          ? (ticket.metadata as SupportTicketInternalDto['metadata'])
          : null,
      status: ticket.status,
      priority: ticket.priority,
      internalNote: ticket.internalNote,
      resolutionNote: ticket.resolutionNote,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      organization: ticket.organization,
      user: ticket.user,
      assignedTo: ticket.assignedTo,
      resolvedBy: ticket.resolvedBy,
    };
  }

  private async validateAssignee(
    assignedToId: string | null | undefined,
  ): Promise<{ id: string; name: string } | null> {
    if (assignedToId === undefined) {
      return null;
    }
    if (assignedToId === null) {
      return null;
    }

    const assignee = await this.prisma.user.findFirst({
      where: { id: assignedToId, deletedAt: null },
      select: {
        id: true,
        name: true,
        systemRole: true,
        isPlatformAdmin: true,
      },
    });

    if (!assignee) {
      throw new NotFoundException('Assigned support operator not found.');
    }

    const role = assignee.systemRole;
    const canOperate =
      role === SystemRole.SUPERADMIN ||
      role === SystemRole.SUPPORT ||
      assignee.isPlatformAdmin === true;

    if (!canOperate) {
      throw new BadRequestException(
        'Assigned user must be SUPPORT or SUPERADMIN.',
      );
    }

    return { id: assignee.id, name: assignee.name };
  }

  private assertStatusTransition(
    current: SupportTicketStatus,
    next: SupportTicketStatus,
  ) {
    if (current === next) return;

    const allowed =
      (current === SupportTicketStatus.OPEN &&
        (next === SupportTicketStatus.IN_REVIEW ||
          next === SupportTicketStatus.RESOLVED)) ||
      (current === SupportTicketStatus.IN_REVIEW &&
        next === SupportTicketStatus.RESOLVED);

    if (!allowed) {
      throw new BadRequestException(
        `Unsupported support ticket transition: ${current} -> ${next}.`,
      );
    }
  }

  async createTicket(
    dto: CreateTicketDto,
    user: JwtPayload,
    req: RequestWithUser,
  ) {
    await this.assertOrgMembership(user);

    const page = this.resolvePage(dto, req);
    const metadata = this.buildMetadata(dto, req);
    const data: Prisma.SupportTicketUncheckedCreateInput = {
      organizationId: user.organizationId!,
      userId: user.userId,
      category: dto.category.trim(),
      message: dto.message.trim(),
      page,
      priority: dto.priority ?? SupportTicketPriority.MEDIUM,
    };
    if (metadata !== undefined) {
      data.metadata = metadata;
    }

    const ticket = await this.prisma.supportTicket.create({
      data,
      select: {
        id: true,
        category: true,
        message: true,
        page: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      action: 'CREATED',
      entityType: AuditEntityType.SUPPORT_TICKET,
      entityId: ticket.id,
      userId: user.userId,
      organizationId: user.organizationId ?? null,
      systemRole: user.systemRole ?? null,
      metadata: {
        category: ticket.category,
        page: ticket.page,
        status: ticket.status,
        priority: ticket.priority,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return ticket;
  }

  async listMyTickets(user: JwtPayload) {
    await this.assertOrgMembership(user);

    return this.prisma.supportTicket.findMany({
      where: {
        userId: user.userId,
        organizationId: user.organizationId!,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        message: true,
        page: true,
        status: true,
        priority: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listTickets(user: JwtPayload, filters: TicketListFilters) {
    this.assertPlatformReader(user);

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.organizationId
          ? { organizationId: filters.organizationId }
          : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500, // safety cap — platform triage view, newest first per status
      select: {
        id: true,
        organizationId: true,
        category: true,
        message: true,
        page: true,
        metadata: true,
        status: true,
        priority: true,
        internalNote: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return tickets.map((ticket) => this.mapTicket(ticket));
  }

  async getTicketById(id: string, user: JwtPayload) {
    this.assertPlatformReader(user);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        category: true,
        message: true,
        page: true,
        metadata: true,
        status: true,
        priority: true,
        internalNote: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket nebyl nalezen.');
    }

    return this.mapTicket(ticket);
  }

  async updateTicket(
    id: string,
    dto: UpdateTicketDto,
    user: JwtPayload,
    req: RequestWithUser,
  ) {
    this.assertSupportOperator(user);

    if (
      dto.assignedToId === undefined &&
      dto.status === undefined &&
      dto.priority === undefined &&
      dto.internalNote === undefined &&
      dto.resolutionNote === undefined
    ) {
      throw new BadRequestException('Support ticket update payload is empty.');
    }

    const current = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        priority: true,
        assignedToId: true,
        internalNote: true,
        resolutionNote: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Support ticket nebyl nalezen.');
    }

    const nextStatus = dto.status ?? current.status;
    this.assertStatusTransition(current.status, nextStatus);

    if (
      nextStatus === SupportTicketStatus.RESOLVED &&
      !(dto.resolutionNote?.trim() || current.resolutionNote?.trim())
    ) {
      throw new BadRequestException(
        'Resolving a support ticket requires a resolution note.',
      );
    }

    const assignee =
      dto.assignedToId === undefined
        ? undefined
        : await this.validateAssignee(dto.assignedToId);

    const updateData: Prisma.SupportTicketUncheckedUpdateInput = {
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.internalNote !== undefined
        ? { internalNote: dto.internalNote }
        : {}),
      ...(dto.resolutionNote !== undefined
        ? { resolutionNote: dto.resolutionNote }
        : {}),
      ...(dto.assignedToId !== undefined
        ? { assignedToId: assignee?.id ?? null }
        : {}),
    };

    let action = 'UPDATED';

    if (nextStatus !== current.status) {
      updateData.status = nextStatus;
      action =
        nextStatus === SupportTicketStatus.RESOLVED ? 'RESOLVED' : 'IN_REVIEW';
    }

    if (nextStatus === SupportTicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = user.userId;
    }

    if (dto.assignedToId !== undefined && action === 'UPDATED') {
      action = dto.assignedToId ? 'ASSIGNED' : 'UNASSIGNED';
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        organizationId: true,
        category: true,
        message: true,
        page: true,
        metadata: true,
        status: true,
        priority: true,
        internalNote: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.auditService.log({
      action,
      entityType: AuditEntityType.SUPPORT_TICKET,
      entityId: ticket.id,
      userId: user.userId,
      organizationId: current.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        fromStatus: current.status,
        toStatus: ticket.status,
        priority: ticket.priority,
        assignedToId: ticket.assignedTo?.id ?? null,
        assignedToName: ticket.assignedTo?.name ?? null,
        resolverId: ticket.resolvedBy?.id ?? null,
        resolverName: ticket.resolvedBy?.name ?? null,
        resolutionNote: ticket.resolutionNote ?? null,
        hasInternalNote: Boolean(ticket.internalNote?.trim()),
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    this.logger.log(`Support ticket updated: ${ticket.id} (${action})`);
    return this.mapTicket(ticket);
  }
}
