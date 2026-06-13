import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, XpEventType } from '@prisma/client';

export type AchievementCondition =
  | { type: 'XP_THRESHOLD'; threshold: number }
  | { type: 'CUSTOM'; key: string; value?: any };

const BADGE_CODES = {
  FIRST_TEST_COMPLETED: 'FIRST_TEST_COMPLETED',
  PERFECT_SCORE: 'PERFECT_SCORE',
  ACTIVE_LEARNER: 'ACTIVE_LEARNER',
} as const;

const DEFAULT_BADGE_DEFINITIONS = [
  {
    code: BADGE_CODES.FIRST_TEST_COMPLETED,
    name: 'První dokončený test',
    description: 'Získáno za první odevzdaný test v organizaci.',
    iconKey: 'badge-first-test',
    xpReward: null,
  },
  {
    code: BADGE_CODES.PERFECT_SCORE,
    name: 'Perfektní výsledek',
    description: 'Získáno za skóre 100 % v testu.',
    iconKey: 'badge-perfect-score',
    xpReward: null,
  },
  {
    code: BADGE_CODES.ACTIVE_LEARNER,
    name: 'Aktivní student',
    description: 'Získáno za tři dokončené testy v organizaci.',
    iconKey: 'badge-active-learner',
    xpReward: null,
  },
] as const;

export type MembershipBadgeView = {
  code: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  awardedAt: Date;
};

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateProgress(membershipId: string, totalXp: number) {
    const [achievements, earned] = await Promise.all([
      this.prisma.achievement.findMany(),
      this.prisma.membershipAchievement.findMany({
        where: { membershipId },
        select: { achievementId: true },
      }),
    ]);
    const earnedIds = new Set(earned.map((item) => item.achievementId));
    const unlockable: string[] = [];

    for (const achievement of achievements) {
      if (earnedIds.has(achievement.id)) continue;
      const condition = (achievement.condition ?? {}) as AchievementCondition;
      if (this.meetsCondition(condition, totalXp)) {
        await this.prisma.membershipAchievement.create({
          data: {
            membershipId,
            achievementId: achievement.id,
          },
        });
        unlockable.push(achievement.id);
      }
    }

    return unlockable;
  }

  async evaluateBadgesForSubmission(
    membershipId: string,
    submissionId: string,
  ): Promise<string[]> {
    await this.ensureDefaultBadgeDefinitions();

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        score: true,
        submittedAt: true,
        status: true,
      },
    });
    if (!submission) return [];
    if (submission.studentId !== membershipId) return [];
    if (!submission.submittedAt) return [];

    return this.syncSubmissionBadges(membershipId, {
      source: 'submission.finish',
      submissionId,
    });
  }

  async getMembershipBadges(
    membershipId: string,
  ): Promise<MembershipBadgeView[]> {
    await this.ensureDefaultBadgeDefinitions();
    await this.syncSubmissionBadges(membershipId, {
      source: 'badge.read',
    });

    const items = await this.prisma.membershipBadge.findMany({
      where: { membershipId },
      orderBy: { awardedAt: 'desc' },
      select: {
        awardedAt: true,
        badgeDefinition: {
          select: {
            code: true,
            name: true,
            description: true,
            iconKey: true,
          },
        },
      },
    });

    return items.map((item) => ({
      code: item.badgeDefinition.code,
      name: item.badgeDefinition.name,
      description: item.badgeDefinition.description ?? null,
      iconKey: item.badgeDefinition.iconKey ?? null,
      awardedAt: item.awardedAt,
    }));
  }

  private async syncSubmissionBadges(
    membershipId: string,
    metadata: { source: string; submissionId?: string },
  ): Promise<string[]> {
    const [
      badgeDefinitions,
      completedCount,
      perfectSubmission,
      existingAwards,
    ] = await Promise.all([
      this.prisma.badgeDefinition.findMany({
        where: {
          code: {
            in: Object.values(BADGE_CODES),
          },
        },
        select: {
          id: true,
          code: true,
          xpReward: true,
        },
      }),
      this.prisma.submission.count({
        where: {
          studentId: membershipId,
          submittedAt: { not: null },
          deletedAt: null,
        },
      }),
      this.prisma.submission.findFirst({
        where: {
          studentId: membershipId,
          submittedAt: { not: null },
          deletedAt: null,
          score: { gte: 0.9999 },
        },
        select: { id: true },
      }),
      this.prisma.membershipBadge.findMany({
        where: { membershipId },
        select: {
          badgeDefinition: {
            select: { code: true },
          },
        },
      }),
    ]);

    const alreadyAwarded = new Set(
      existingAwards.map((item) => item.badgeDefinition.code),
    );
    const definitionsByCode = new Map(
      badgeDefinitions.map((item) => [item.code, item]),
    );

    const toAwardCodes: string[] = [];
    if (
      completedCount >= 1 &&
      !alreadyAwarded.has(BADGE_CODES.FIRST_TEST_COMPLETED)
    ) {
      toAwardCodes.push(BADGE_CODES.FIRST_TEST_COMPLETED);
    }
    if (perfectSubmission && !alreadyAwarded.has(BADGE_CODES.PERFECT_SCORE)) {
      toAwardCodes.push(BADGE_CODES.PERFECT_SCORE);
    }
    if (
      completedCount >= 3 &&
      !alreadyAwarded.has(BADGE_CODES.ACTIVE_LEARNER)
    ) {
      toAwardCodes.push(BADGE_CODES.ACTIVE_LEARNER);
    }

    const definitionsToAward = toAwardCodes
      .map((code) => definitionsByCode.get(code))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (definitionsToAward.length === 0) return [];

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipBadge.createMany({
        data: definitionsToAward.map((definition) => ({
          membershipId,
          badgeDefinitionId: definition.id,
          awardedAt: now,
          metadata: {
            source: metadata.source,
            ...(metadata.submissionId
              ? { submissionId: metadata.submissionId }
              : {}),
          } as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });

      const xpRewardTotal = definitionsToAward.reduce(
        (sum, definition) => sum + (definition.xpReward ?? 0),
        0,
      );

      if (xpRewardTotal > 0) {
        await tx.xpEvent.create({
          data: {
            membershipId,
            type: XpEventType.CUSTOM,
            value: xpRewardTotal,
            description: 'Badge reward',
            metadata: {
              source: 'badges',
              ...(metadata.submissionId
                ? { submissionId: metadata.submissionId }
                : {}),
              badgeCodes: definitionsToAward.map(
                (definition) => definition.code,
              ),
            } as Prisma.InputJsonValue,
          },
        });
        await tx.membership.update({
          where: { id: membershipId },
          data: {
            xp: { increment: xpRewardTotal },
          },
        });
      }
    });

    return definitionsToAward.map((definition) => definition.code);
  }

  private async ensureDefaultBadgeDefinitions() {
    await this.prisma.badgeDefinition.createMany({
      data: DEFAULT_BADGE_DEFINITIONS.map((definition) => ({
        code: definition.code,
        name: definition.name,
        description: definition.description,
        iconKey: definition.iconKey,
        xpReward: definition.xpReward,
      })),
      skipDuplicates: true,
    });
  }

  private meetsCondition(condition: AchievementCondition, xp: number) {
    if (condition?.type === 'XP_THRESHOLD') {
      return xp >= (condition.threshold ?? 0);
    }
    // CUSTOM/NOP -> manual unlock handled elsewhere
    return false;
  }
}
