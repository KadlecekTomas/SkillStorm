import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  XP_AWARDED_EVENT,
  XpAwardedPayload,
  xpEvents,
} from 'src/gamification/events/xp.events';

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

  onModuleInit() {
    xpEvents.on(XP_AWARDED_EVENT, this.handleXpAwarded);
  }

  onModuleDestroy() {
    xpEvents.off(XP_AWARDED_EVENT, this.handleXpAwarded);
  }
}
