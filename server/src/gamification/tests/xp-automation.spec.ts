import { GamificationService } from '../gamification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AchievementsService } from '../achievements.service';
import {
  OrganizationRole,
  XpEventType,
} from '@prisma/client';
import { XpAnalyticsListener } from 'src/analytics/listeners/xp-analytics.listener';

describe('XP automation', () => {
  let prismaMock: any;
  let txMock: any;
  let achievementsMock: AchievementsService;
  let service: GamificationService;

  beforeEach(() => {
    txMock = {
      membership: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      xpEvent: {
        create: jest.fn(),
      },
      level: {
        findFirst: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn(async (cb: any) => cb(txMock)),
      level: {
        findFirst: jest.fn(),
      },
    };

    achievementsMock = {
      evaluateProgress: jest.fn(),
    } as unknown as AchievementsService;

    service = new GamificationService(
      prismaMock as PrismaService,
      achievementsMock,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [XpEventType.USER_LOGIN, 5],
    [XpEventType.MATERIAL_VIEWED, 10],
    [XpEventType.TEST_COMPLETED, 50],
  ])(
    'awards XP and emits analytics hook for %s events',
    async (eventType, amount) => {
      const membership = {
        id: 'membership-1',
        xp: 100,
        level: 1,
        userId: 'user-1',
        organizationId: 'org-1',
        role: OrganizationRole.STUDENT,
      };

      txMock.membership.findUnique.mockResolvedValueOnce({ ...membership });
      txMock.level.findFirst.mockResolvedValueOnce({ levelNo: 2 });
      txMock.xpEvent.create.mockResolvedValueOnce({ id: 'xp-1' });
      txMock.membership.update.mockResolvedValueOnce({
        ...membership,
        xp: membership.xp + amount,
        level: 2,
      });

      const analyticsPrisma = {
        analyticsEvent: {
          create: jest.fn().mockResolvedValue(true),
        },
      };
      const analyticsListener = new XpAnalyticsListener(
        analyticsPrisma as unknown as PrismaService,
      );
      analyticsListener.onModuleInit();

      try {
        const result = await service.awardXpForEvent(
          membership.id,
          eventType,
          amount,
          { trigger: 'spec' },
        );

        expect(result?.xp).toBe(membership.xp + amount);
        expect(txMock.xpEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              membershipId: membership.id,
              type: eventType,
              value: amount,
            }),
          }),
        );
        expect(achievementsMock.evaluateProgress).toHaveBeenCalledWith(
          membership.id,
          membership.xp + amount,
        );
        expect(analyticsPrisma.analyticsEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              category: 'gamification',
              action: 'xp_awarded',
              label: eventType,
              value: amount,
            }),
          }),
        );
      } finally {
        analyticsListener.onModuleDestroy();
      }
    },
  );
});
