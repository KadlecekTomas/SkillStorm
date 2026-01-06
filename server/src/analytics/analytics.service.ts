import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma, AnalyticsEvent } from '@prisma/client';
import type { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { subDays } from 'date-fns';

type AnalyticsSummaryItem = { category: string; action: string; count: number };
type AnalyticsSummary = { since: Date; items: AnalyticsSummaryItem[] };

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    dto: LogAnalyticsEventDto,
    actor: JwtPayload,
  ): Promise<AnalyticsEvent> {
    const data: Prisma.AnalyticsEventUncheckedCreateInput = {
      userId: actor.userId ?? null,
      organizationId: actor.organizationId ?? null,
      category: dto.category,
      action: dto.action,
      label: dto.label ?? null,
      value: dto.value ?? null,
    };
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    return this.prisma.analyticsEvent.create({ data });
  }

  async summary(
    days = 7,
    organizationId?: string | null,
  ): Promise<AnalyticsSummary> {
    const since = subDays(new Date(), days);
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        category: true,
        action: true,
      },
    });

    const aggregated = new Map<string, AnalyticsSummaryItem>();
    for (const event of events) {
      const key = `${event.category}::${event.action}`;
      const next = aggregated.get(key) ?? {
        category: event.category,
        action: event.action,
        count: 0,
      };
      next.count += 1;
      aggregated.set(key, next);
    }
    const items = Array.from(aggregated.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    return {
      since,
      items,
    };
  }
}
