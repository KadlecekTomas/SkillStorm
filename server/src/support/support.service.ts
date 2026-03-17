import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditEntityType, Prisma, SystemRole } from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { RequestWithUser } from '@/types/request-with-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

const SUPPORT_STATUS_OPEN = 'OPEN';
const SUPPORT_STATUS_RESOLVED = 'RESOLVED';

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

  private resolvePage(dto: CreateTicketDto, req: RequestWithUser): string | null {
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

  private buildMetadata(dto: CreateTicketDto, req: RequestWithUser): Prisma.InputJsonValue | undefined {
    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      page: this.resolvePage(dto, req),
      userAgent: req.get('user-agent') ?? null,
    };

    return metadata as Prisma.InputJsonValue;
  }

  async createTicket(dto: CreateTicketDto, user: JwtPayload, req: RequestWithUser) {
    await this.assertOrgMembership(user);

    const page = this.resolvePage(dto, req);
    const metadata = this.buildMetadata(dto, req);
    const data: Prisma.SupportTicketUncheckedCreateInput = {
      organizationId: user.organizationId!,
      userId: user.userId,
      category: dto.category.trim(),
      message: dto.message.trim(),
      page,
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
        createdAt: true,
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
        resolvedAt: true,
        createdAt: true,
      },
    });
  }

  async listOpenTickets() {
    return this.prisma.supportTicket.findMany({
      where: { status: SUPPORT_STATUS_OPEN },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        organizationId: true,
        category: true,
        message: true,
        page: true,
        metadata: true,
        status: true,
        createdAt: true,
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async resolveTicket(id: string, dto: ResolveTicketDto, user: JwtPayload, req: RequestWithUser) {
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Tuto akci smí provést jen SUPERADMIN.');
    }
    if (dto.status !== SUPPORT_STATUS_RESOLVED) {
      throw new BadRequestException('Unsupported support ticket status.');
    }

    const current = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Support ticket nebyl nalezen.');
    }

    const resolvedAt = new Date();
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SUPPORT_STATUS_RESOLVED,
        resolvedAt,
        resolvedById: user.userId,
      },
      select: {
        id: true,
        organizationId: true,
        category: true,
        status: true,
        resolvedAt: true,
        resolvedById: true,
      },
    });

    await this.auditService.log({
      action: 'RESOLVED',
      entityType: AuditEntityType.SUPPORT_TICKET,
      entityId: ticket.id,
      userId: user.userId,
      organizationId: current.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        status: ticket.status,
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    this.logger.log(`Support ticket resolved: ${ticket.id}`);
    return ticket;
  }
}
