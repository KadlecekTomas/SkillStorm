import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { subHours } from 'date-fns';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    const cutoff = subHours(new Date(), 24);
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { usedAt: { lt: cutoff } },
        ],
      },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired/used password reset token(s)`);
    }
  }
}
