import { Injectable } from '@nestjs/common';
import type { AuditEntityType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  sanitizeAuditChangedFields,
  sanitizeAuditMetadata,
} from './audit-metadata.sanitize';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AuditEventInput {
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  /** Caller's systemRole at time of action — stored for compliance attribution. */
  systemRole?: string | null;
  metadata?: Prisma.InputJsonValue;
  changedFields?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQueryInput {
  /** Scope to a single org. Omit for platform-wide queries. */
  organizationId?: string;
  entityType?: AuditEntityType;
  /** Substring match on action field. */
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export type AuditDbClient = PrismaService | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Output DTO
// ---------------------------------------------------------------------------

export type AuditLogDto = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  systemRole: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  changedFields: unknown;
  createdAt: Date;
};

export type AuditQueryResult = {
  items: AuditLogDto[];
  meta: { page: number; limit: number; total: number; pages: number };
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append a canonical audit event.
   *
   * Critical invariant: audit failures are fail-closed. Callers that require
   * mutation+audit atomicity pass the active Prisma TransactionClient, so an
   * audit insert failure rolls the business mutation back as part of the same
   * transaction. We intentionally do not swallow FK errors or log raw input.
   */
  async log(
    event: AuditEventInput,
    db: AuditDbClient = this.prisma,
  ): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      userId: event.userId ?? null,
      organizationId: event.organizationId ?? null,
      systemRole: event.systemRole ?? null,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
    };
    const sanitizedMetadata = sanitizeAuditMetadata(event.metadata ?? null);
    if (sanitizedMetadata !== null && sanitizedMetadata !== undefined) {
      data.metadata = sanitizedMetadata as Prisma.InputJsonValue;
    }
    const sanitizedChangedFields = sanitizeAuditChangedFields(
      event.changedFields ?? null,
    );
    if (sanitizedChangedFields !== null) {
      data.changedFields = sanitizedChangedFields as Prisma.InputJsonValue;
    }
    await db.auditLog.create({ data });
  }

  /**
   * Query audit logs with filtering and pagination.
   *
   * @param opts.organizationId — tenant scope (omit for platform-wide)
   * @param opts.entityType     — filter by entity type
   * @param opts.action         — substring match on action
   * @param opts.dateFrom/To    — time window
   * @param opts.page/limit     — pagination (default: page=1, limit=50)
   */
  async query(opts: AuditQueryInput): Promise<AuditQueryResult> {
    const page = opts.page ?? 1;
    const limit = Math.min(200, opts.limit ?? 50);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (opts.organizationId) {
      where.organizationId = opts.organizationId;
    }
    if (opts.entityType) {
      where.entityType = opts.entityType;
    }
    if (opts.action) {
      where.action = { contains: opts.action, mode: 'insensitive' };
    }
    if (opts.dateFrom || opts.dateTo) {
      where.createdAt = {
        ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
        ...(opts.dateTo ? { lte: opts.dateTo } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          organizationId: true,
          systemRole: true,
          entityType: true,
          entityId: true,
          action: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          changedFields: true,
          createdAt: true,
        },
      }),
    ]);

    const items: AuditLogDto[] = rows.map((r) => ({
      ...r,
      entityType: r.entityType as string,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
