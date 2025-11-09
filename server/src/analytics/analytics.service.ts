import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import { JwtPayload } from '@/auth/types/jwt-payload';
import { subDays } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(dto: LogAnalyticsEventDto, actor: JwtPayload) {
    return this.prisma.analyticsEvent.create({
      data: {
        userId: actor.userId ?? null,
        organizationId: actor.organizationId ?? null,
        category: dto.category,
        action: dto.action,
        metadata: dto.metadata ?? null,
        label: dto.label ?? null,
        value: dto.value ?? null,
      },
    });
  }

  async summary(days = 7, organizationId?: string | null) {
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

    const aggregated = new Map<
      string,
      { category: string; action: string; count: number }
    >();
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
