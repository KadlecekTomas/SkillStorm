import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddXpEventDto } from './dto/add-xp-event.dto';
import { AchievementsService } from './achievements.service';
import { JwtPayload } from 'src/auth/types/jwt-payload';

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
  ) {}

  async addXpEvent(dto: AddXpEventDto, actor: JwtPayload) {
    const membership = await this.resolveMembership(
      dto.membershipId,
      actor,
    );
    const [, level] = await Promise.all([
      this.prisma.xpEvent.create({
        data: {
          membershipId: membership.id,
          type: dto.type,
          value: dto.value,
          description: dto.description ?? null,
        },
      }),
      this.resolveLevel(membership.xp + dto.value),
    ]);

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        xp: membership.xp + dto.value,
        level: level?.levelNo ?? undefined,
      },
      select: {
        id: true,
        xp: true,
        level: true,
        userId: true,
        organizationId: true,
      },
    });

    await this.achievements.evaluateProgress(updated.id, updated.xp);
    return updated;
  }

  async getSummary(membershipId: string, actor: JwtPayload) {
    const membershipSelect = {
      id: true,
      userId: true,
      organizationId: true,
      xp: true,
      level: true,
    };
    const membership =
      membershipId === 'me'
        ? await this.prisma.membership.findFirst({
            where: { userId: actor.userId ?? undefined },
            select: membershipSelect,
          })
        : await this.prisma.membership.findUnique({
            where: { id: membershipId },
            select: membershipSelect,
          });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    this.assertMembershipAccess(membership, actor);

    const [xpEvents, nextLevel, achievements] = await Promise.all([
      this.prisma.xpEvent.findMany({
        where: { membershipId: membership.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.level.findFirst({
        where: { minXp: { gt: membership.xp } },
        orderBy: { minXp: 'asc' },
      }),
      this.prisma.membershipAchievement.findMany({
        where: { membershipId: membership.id },
        include: { achievement: true },
      }),
    ]);

    return {
      membershipId: membership.id,
      xp: membership.xp,
      level: membership.level,
      nextLevelXp: nextLevel?.minXp ?? null,
      achievements: achievements.map((item) => ({
        ...item.achievement,
        achievedAt: item.achievedAt,
      })),
      events: xpEvents,
    };
  }

  private async resolveLevel(totalXp: number) {
    return this.prisma.level.findFirst({
      where: { minXp: { lte: totalXp } },
      orderBy: { minXp: 'desc' },
    });
  }

  private assertMembershipAccess(
    membership: { userId: string; organizationId: string | null },
    actor: JwtPayload,
  ) {
    if (actor.systemRole === 'SUPERADMIN') return;
    if (
      actor.userId !== membership.userId &&
      actor.organizationId !== membership.organizationId
    ) {
      throw new ForbiddenException('Not allowed to manage this membership');
    }
  }

  private async resolveMembership(membershipId: string, actor: JwtPayload) {
    const defaultSelect = {
      id: true,
      userId: true,
      organizationId: true,
      xp: true,
    };
    if (membershipId === 'me') {
      const record = await this.prisma.membership.findFirst({
        where: { userId: actor.userId ?? undefined },
        select: defaultSelect,
      });
      if (!record) throw new NotFoundException('Membership not found');
      this.assertMembershipAccess(record, actor);
      return record;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: defaultSelect,
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    this.assertMembershipAccess(membership, actor);
    return membership;
  }
}
