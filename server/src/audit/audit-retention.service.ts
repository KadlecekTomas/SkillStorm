import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { subMonths } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { runWithPrismaContext } from '@/prisma/prisma-context';

/**
 * GDPR audit retention service.
 *
 * Policy: retain audit log structural data indefinitely; anonymize PII fields
 * (userId, ipAddress, userAgent) for records older than 24 months.
 *
 * Why updateMany (not deleteMany)?
 *   - AuditLog records are immutable (PrismaService middleware blocks delete/deleteMany).
 *   - GDPR purpose limitation: the audit trail (action, entityType, entityId, createdAt)
 *     must be retained for compliance; only the personal identifiers are removed.
 *   - updateMany is intentionally NOT blocked by the immutability middleware — this is
 *     the only sanctioned write path for existing audit records.
 *
 * Schedule: daily at 03:15 UTC (offset from PrivacyService.handleRetention at 03:00
 * to avoid simultaneous DB load).
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('15 3 * * *')
  async anonymizeExpiredAuditLogs(): Promise<void> {
    const cutoff = subMonths(new Date(), 24);
    this.logger.log(
      `[AuditRetention] Anonymizing audit logs older than ${cutoff.toISOString()}`,
    );

    try {
      const result = await runWithPrismaContext(
        { auditRetentionBypass: true },
        () =>
          this.prisma.auditLog.updateMany({
            where: {
              createdAt: { lt: cutoff },
              // Only touch records that still have PII (avoid redundant writes)
              OR: [
                { userId: { not: null } },
                { ipAddress: { not: null } },
                { userAgent: { not: null } },
              ],
            },
            data: {
              userId: null,
              ipAddress: null,
              userAgent: null,
            },
          }),
      );

      this.logger.log(
        `[AuditRetention] Anonymized ${result.count} audit log record(s).`,
      );
    } catch (err) {
      this.logger.error('[AuditRetention] Anonymization failed:', err);
      // Do not rethrow — a retention failure must not crash the application.
    }
  }
}
