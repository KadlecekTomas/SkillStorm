import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { AddXpEventDto } from './dto/add-xp-event.dto';
import { AchievementsService } from './achievements.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { Prisma, XpEventType } from '@prisma/client';
import { OrganizationRole } from '@prisma/client';
import { emitXpAwarded } from './events/xp.events';

const XP_ALLOWED_ROLES = new Set<OrganizationRole>([
  OrganizationRole.STUDENT,
  OrganizationRole.TEACHER,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
]);

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
  ) {}

  async addXpEvent(dto: AddXpEventDto, actor: JwtPayload) {
    const membership = await this.resolveMembership(dto.membershipId, actor);
    const mergedMetadata =
      dto.metadata || dto.description
        ? {
            ...(dto.metadata ?? {}),
            ...(dto.description ? { description: dto.description } : {}),
          }
        : undefined;
    const updated = await this.awardXpForEvent(
      membership.id,
      dto.type,
      dto.value,
      mergedMetadata,
    );
    return updated ?? membership;
  }

  async awardXpForEvent(
    membershipId: string,
    type: XpEventType,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    if (!amount || amount <= 0) return null;

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          xp: true,
          level: true,
          userId: true,
          organizationId: true,
          role: true,
        },
      });
      if (!membership) return null;
      if (!XP_ALLOWED_ROLES.has(membership.role)) {
        return null;
      }

      const totalXp = membership.xp + amount;
      const resolvedLevel = await this.resolveLevelWithClient(tx, totalXp);
      const xpEventData: Prisma.XpEventUncheckedCreateInput = {
        membershipId,
        type,
        value: amount,
        description: metadata?.description ?? null,
      };
      if (metadata !== undefined) {
        xpEventData.metadata = metadata as Prisma.InputJsonValue;
      }
      await tx.xpEvent.create({ data: xpEventData });
      const updatedMembership = await tx.membership.update({
        where: { id: membershipId },
        data: {
          xp: totalXp,
          level: resolvedLevel?.levelNo ?? membership.level,
        },
        select: {
          id: true,
          xp: true,
          level: true,
          userId: true,
          organizationId: true,
          role: true,
        },
      });
      return updatedMembership;
    });

    if (!result) return null;

    await this.achievements.evaluateProgress(result.id, result.xp);
    emitXpAwarded({
      membershipId: result.id,
      userId: result.userId,
      organizationId: result.organizationId,
      type,
      amount,
      metadata: metadata ?? null,
    });

    return result;
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
            where: { ...(actor.userId ? { userId: actor.userId } : {}) },
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

  async getMyBadges(actor: JwtPayload) {
    const membership = await this.resolveMembership('me', actor);
    return this.achievements.getMembershipBadges(membership.id);
  }

  async evaluateBadgesForSubmission(
    membershipId: string,
    submissionId: string,
  ) {
    return this.achievements.evaluateBadgesForSubmission(
      membershipId,
      submissionId,
    );
  }

  private async resolveLevel(totalXp: number) {
    return this.resolveLevelWithClient(this.prisma, totalXp);
  }

  private async resolveLevelWithClient(
    client: Prisma.TransactionClient | PrismaService,
    totalXp: number,
  ) {
    return client.level.findFirst({
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
      level: true,
    };
    if (membershipId === 'me') {
      const record = await this.prisma.membership.findFirst({
        where: {
          ...(actor.membershipId ? { id: actor.membershipId } : {}),
          ...(actor.userId ? { userId: actor.userId } : {}),
          ...(actor.organizationId ? { organizationId: actor.organizationId } : {}),
        },
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
