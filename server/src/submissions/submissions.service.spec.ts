import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubmissionsService, SUBMISSION_LOCKED_ERROR_CODE } from './submissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { GamificationService } from '@/gamification/gamification.service';
import { OrganizationRole } from '@prisma/client';

describe('SubmissionsService (integrity)', () => {
  let service: SubmissionsService;
  let prisma: {
    submission: { findUnique: jest.Mock; findFirst: jest.Mock };
    membership: { findFirst: jest.Mock };
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
      submission: { findUnique: jest.fn(), findFirst: jest.fn() },
      membership: { findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: GamificationService, useValue: { awardXpForEvent: jest.fn() } },
      ],
    }).compile();
    service = module.get(SubmissionsService);
  });

  describe('updateResponses after submit', () => {
    it('throws 409 with errorCode SUBMISSION_LOCKED when submission already submitted', async () => {
      prisma.membership.findFirst.mockResolvedValue(membershipA);
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
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.submission.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-other-org', organizationId: orgA },
        include: expect.any(Object),
      });
    });
  });
});
