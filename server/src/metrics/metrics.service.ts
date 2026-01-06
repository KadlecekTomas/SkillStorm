import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { RecordRbacMetricDto } from './dto/record-rbac-metric.dto';
import { AuditEntityType } from '@prisma/client';
import { subDays } from 'date-fns';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordForbiddenAccess(payload: RecordRbacMetricDto) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: payload.userId ?? null,
          entityType: AuditEntityType.PERMISSION,
          action: 'FORBIDDEN_ACCESS',
          metadata: {
            route: payload.route,
            permissionKey: payload.permissionKey ?? null,
            message: payload.message ?? null,
          },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to store RBAC metric for ${payload.route}: ${
          (error as Error).message
        }`,
      );
    }
  }

  async summary(days = 7) {
    const since = subDays(new Date(), days);
    const count = await this.prisma.auditLog.count({
      where: {
        action: 'FORBIDDEN_ACCESS',
        createdAt: { gte: since },
      },
    });

    return {
      forbiddenSince: since.toISOString(),
      forbiddenCount: count,
    };
  }
}
