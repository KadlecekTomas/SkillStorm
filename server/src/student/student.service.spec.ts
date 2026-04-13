import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { StudentsService } from './student.service';
import { AuditService } from '@/audit/audit.service';
import { OrganizationRole, SubmissionStatus } from '@prisma/client';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: {
    student: { findUnique: jest.Mock };
    academicYear: { findFirst: jest.Mock };
    submission: { findMany: jest.Mock };
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      student: { findUnique: jest.fn() },
      academicYear: { findFirst: jest.fn() },
      submission: { findMany: jest.fn() },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: {} },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  it('uses completed membership-scoped submissions and returns non-zero analytics for a submitted scored test', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1',
      orgId: 'org-1',
      deletedAt: null,
      membershipId: 'membership-1',
      membership: {
        user: { name: 'Alice Student' },
      },
      enrollments: [
        {
          yearId: 'year-1',
          academicYear: { isCurrent: true, label: '2025/26' },
          classSection: { label: '5.A', grade: 5, section: 'A' },
        },
      ],
    });
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.submission.findMany.mockResolvedValue([
      {
        earnedPoints: 8,
        maxPoints: 10,
        submittedAt: new Date('2026-04-13T10:00:00.000Z'),
        testId: 'test-1',
        status: SubmissionStatus.APPROVED,
        assignment: {
          topicLevelId: 'topic-1',
          topicLevel: {
            id: 'topic-1',
            catalogTopic: { name: 'Zlomky' },
          },
          test: {
            id: 'test-1',
            title: 'Matematika 1',
            questions: [{ score: 5 }, { score: 5 }],
          },
        },
      },
    ]);

    const result = await service.getDetail(
      'student-1',
      {
        userId: 'director-1',
        organizationId: 'org-1',
        organizationRole: OrganizationRole.DIRECTOR,
      } as never,
      'year-1',
    );

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 'membership-1',
          organizationId: 'org-1',
          deletedAt: null,
          submittedAt: { not: null },
          status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] },
          assignment: expect.objectContaining({
            organizationId: 'org-1',
            yearId: 'year-1',
          }),
        }),
      }),
    );
    expect(result.classroomLabel).toBe('5.A');
    expect(result.performanceSummary.completedTests).toBe(1);
    expect(result.performanceSummary.averageScore).toBe(80);
    expect(result.performanceSummary.lastActivityAt).toBe(
      '2026-04-13T10:00:00.000Z',
    );
    expect(result.progressByTopic).toEqual([
      {
        topicId: 'topic-1',
        topicName: 'Zlomky',
        averageScore: 80,
      },
    ]);
    expect(result.recentTests).toEqual([
      {
        testId: 'test-1',
        title: 'Matematika 1',
        score: 8,
        maxScore: 10,
        submittedAt: '2026-04-13T10:00:00.000Z',
      },
    ]);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('keeps empty analytics consistent for a student without completed submissions', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1',
      orgId: 'org-1',
      deletedAt: null,
      membershipId: 'membership-1',
      membership: {
        user: { name: 'Alice Student' },
      },
      enrollments: [
        {
          yearId: 'year-1',
          academicYear: { isCurrent: true, label: '2025/26' },
          classSection: { label: '5.A', grade: 5, section: 'A' },
        },
      ],
    });
    prisma.submission.findMany.mockResolvedValue([]);

    const result = await service.getDetail(
      'student-1',
      {
        userId: 'director-1',
        organizationId: 'org-1',
        organizationRole: OrganizationRole.DIRECTOR,
      } as never,
    );

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 'membership-1',
          organizationId: 'org-1',
          submittedAt: { not: null },
        }),
      }),
    );
    expect(result.performanceSummary).toEqual({
      averageScore: 0,
      completedTests: 0,
      lastActivityAt: null,
    });
    expect(result.progressByTopic).toEqual([]);
    expect(result.recentTests).toEqual([]);
  });
});
