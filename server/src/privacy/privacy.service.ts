import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { AuditEntityType } from '@prisma/client';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async anonymizeUser(userId: string, triggeredBy: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, anonymized: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.anonymized) return;

    const anonymizedEmail = `anon-${uuidv4()}@example.local`;
    const memberships = await this.prisma.membership.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const membershipIds = memberships.map((m) => m.id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          anonymized: true,
          anonymizedAt: new Date(),
          name: 'Anonymizovaný uživatel',
          email: anonymizedEmail,
          preferredLang: null,
          username: null,
        },
      }),
      this.prisma.submission.updateMany({
        where: { studentId: { in: membershipIds } },
        data: { isAnonymous: true },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: triggeredBy ?? null,
          entityId: userId,
          organizationId: null,
          entityType: AuditEntityType.USER,
          action: 'USER_ANONYMIZED',
        },
      }),
    ]);
  }

  async cleanupDeletedUsers(): Promise<void> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const yearAgo = new Date();
    yearAgo.setMonth(yearAgo.getMonth() - 12);
    const users = await this.prisma.user.findMany({
      where: {
        anonymized: true,
        anonymizedAt: { not: null, lt: sixMonthsAgo, gt: yearAgo },
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) return;

    // cleanup technical residues only, keep anonymized users/submissions
    await this.prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await this.prisma.revokedToken.deleteMany({ where: { userId: { in: userIds } } });
    await this.prisma.userPermission.deleteMany({ where: { userId: { in: userIds } } });
  }

  // Audit log PII anonymization is handled by AuditRetentionService (runs at 03:15 UTC).
  // This job runs at 03:00 UTC to clean up anonymized user tokens and sessions only.
  @Cron('0 3 * * *')
  async handleRetention(): Promise<void> {
    await this.cleanupDeletedUsers();
  }
}
