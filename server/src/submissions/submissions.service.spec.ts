import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SubmissionsService, SUBMISSION_LOCKED_ERROR_CODE } from './submissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { GamificationService } from '@/gamification/gamification.service';
import { AuditService } from '@/audit/audit.service';
import { OrganizationRole } from '@prisma/client';

describe('SubmissionsService (integrity)', () => {
  let service: SubmissionsService;
  let prisma: {
    submission: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    membership: { findFirst: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };

  const orgA = 'org-a';
  const orgB = 'org-b';
  const membershipA = {
    id: 'mem-a',
    organizationId: orgA,
    role: OrganizationRole.STUDENT,
  };

  beforeEach(async () => {
    prisma = {
      submission: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      membership: { findFirst: jest.fn() },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: GamificationService, useValue: { awardXpForEvent: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    service = module.get(SubmissionsService);
  });

  describe('updateResponses after submit', () => {
    it('throws 409 with errorCode SUBMISSION_LOCKED when submission already submitted', async () => {
      prisma.membership.findFirst.mockResolvedValue(membershipA);
      // updateResponses runs inside $transaction(fn): execute the callback with the mock tx.
      prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
        fn(prisma),
      );
      prisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        organizationId: orgA,
        assignmentId: 'a1',
        testId: 't1',
        studentId: membershipA.id,
        assignment: { organizationId: orgA },
        student: { id: membershipA.id, organizationId: orgA },
        responses: [],
        submittedAt: new Date('2025-01-01'),
      });

      let err: ConflictException | null = null;
      try {
        await service.updateResponses(
          'sub-1',
          { responses: [{ questionId: 'q1', givenText: 'x' }] },
          {
            userId: 'u1',
            organizationId: orgA,
            membershipId: membershipA.id,
          } as any,
        );
      } catch (e) {
        err = e as ConflictException;
      }
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as any).response?.errorCode).toBe(SUBMISSION_LOCKED_ERROR_CODE);
    });
  });

  describe('org scoping', () => {
    it('findOne returns 404 when submission is in another org (do not leak existence)', async () => {
      prisma.membership.findFirst.mockResolvedValue(membershipA);
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('sub-other-org', {
          userId: 'u1',
          organizationId: orgA,
          membershipId: membershipA.id,
        } as any, {
          organizationId: orgA,
          membershipId: membershipA.id,
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.submission.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-other-org', organizationId: orgA },
        select: expect.any(Object),
      });
    });
  });

  describe('list payload hardening', () => {
    it('findAll omits responses from list payload', async () => {
      prisma.membership.findFirst.mockResolvedValue(membershipA);
      prisma.submission.count.mockReturnValue('count-query');
      prisma.submission.findMany.mockReturnValue('findMany-query');
      prisma.$transaction.mockResolvedValue([
        1,
        [
          {
            id: 'sub-1',
            assignmentId: 'a1',
            testId: 't1',
            status: 'APPROVED',
            score: 0.8,
            submittedAt: new Date('2025-01-01T00:00:00.000Z'),
            attemptNo: 1,
            isAnonymous: false,
            student: { user: { name: 'Student A' } },
          },
        ],
      ]);

      const result = await service.findAll(
        {},
        {
          userId: 'u1',
          organizationId: orgA,
          membershipId: membershipA.id,
        } as any,
        {
          organizationId: orgA,
          membershipId: membershipA.id,
        } as any,
        { page: 1, limit: 50 },
      );

      expect(prisma.submission.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        select: expect.objectContaining({
          assignmentId: true,
          attemptNo: true,
          id: true,
          isAnonymous: true,
          score: true,
          status: true,
          student: expect.any(Object),
          submittedAt: true,
          testId: true,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(result.data[0]).toEqual({
        id: 'sub-1',
        assignmentId: 'a1',
        testId: 't1',
        status: 'APPROVED',
        score: 0.8,
        earnedPoints: null,
        maxPoints: null,
        percentage: null,
        submittedAt: new Date('2025-01-01T00:00:00.000Z'),
        attemptNo: 1,
        isAnonymous: false,
        student: null,
      });
      expect(result.data[0]).not.toHaveProperty('responses');
    });
  });
});
