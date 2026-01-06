import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { XpAwardedPayload } from '@/gamification/events/xp.events';
import { XP_AWARDED_EVENT, xpEvents } from '@/gamification/events/xp.events';

@Injectable()
export class XpAnalyticsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XpAnalyticsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly handleXpAwarded = async (payload: XpAwardedPayload) => {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          category: 'gamification',
          action: 'xp_awarded',
          label: payload.type,
          value: payload.amount,
          metadata: {
            ...(payload.metadata ?? {}),
            membershipId: payload.membershipId,
          },
          organizationId: payload.organizationId,
          userId: payload.userId,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to persist XP analytics event',
        (error as Error)?.stack ?? String(error),
      );
    }
  };

  onModuleInit(): void {
    xpEvents.on(XP_AWARDED_EVENT, this.handleXpAwarded);
  }

  onModuleDestroy(): void {
    xpEvents.off(XP_AWARDED_EVENT, this.handleXpAwarded);
  }
}
