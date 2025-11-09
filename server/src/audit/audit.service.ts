import { Injectable, Logger } from '@nestjs/common';
import {
  AuditEntityType,
  Prisma,
  PrismaClientKnownRequestError,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuditEventInput {
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId ?? null,
          userId: event.userId ?? null,
          organizationId: event.organizationId ?? null,
          metadata: event.metadata ?? null,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
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
