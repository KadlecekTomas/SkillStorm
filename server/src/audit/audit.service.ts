import { Injectable, Logger } from '@nestjs/common';
import type { AuditEntityType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuditEventInput {
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      const data: Prisma.AuditLogUncheckedCreateInput = {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        userId: event.userId ?? null,
        organizationId: event.organizationId ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      };
      if (event.metadata !== undefined) {
        data.metadata = event.metadata;
      }
      await this.prisma.auditLog.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        this.logger.warn(
          `Audit log skipped due to missing relation: ${JSON.stringify(event)}`,
        );
        return;
      }
      throw error;
    }
  }
}
