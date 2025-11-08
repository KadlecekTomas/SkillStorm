import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type AchievementCondition =
  | { type: 'XP_THRESHOLD'; threshold: number }
  | { type: 'CUSTOM'; key: string; value?: any };

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
      const condition = (achievement.condition ??
        {}) as AchievementCondition;
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

  private meetsCondition(condition: AchievementCondition, xp: number) {
    if (condition?.type === 'XP_THRESHOLD') {
      return xp >= (condition.threshold ?? 0);
    }
    // CUSTOM/NOP -> manual unlock handled elsewhere
    return false;
  }
}
