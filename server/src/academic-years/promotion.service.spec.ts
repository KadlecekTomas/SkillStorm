import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { PromotionService } from './promotion.service';
import { OrganizationRole } from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';

const directorUser: JwtPayload = {
  userId: 'u1',
  email: 'd@test.cz',
  organizationId: 'org-1',
  organizationRole: OrganizationRole.DIRECTOR,
};

const teacherUser: JwtPayload = {
  userId: 'u2',
  email: 't@test.cz',
  organizationId: 'org-1',
  organizationRole: OrganizationRole.TEACHER,
};

const fromYear = {
  id: 'year-from',
  orgId: 'org-1',
  startsAt: new Date('2023-09-01'),
  endsAt: new Date('2024-06-30'),
  label: '2023/24',
};

const toYear = {
  id: 'year-to',
  orgId: 'org-1',
  startsAt: new Date('2024-09-01'),
  label: '2024/25',
};

type FindFirstArgs = { where?: Record<string, unknown> };

/**
 * The service resolves academic years with `findFirst` (not `findUnique`):
 *   1. where.id === fromYearId        → source year
 *   2. where.id === toYearId          → target year
 *   3. where.startsAt = { gt: ... }   → "immediate next year by startsAt"
 * This helper keeps the mock robust regardless of call order (Promise.all).
 */
function makeFindFirst(opts: {
  from?: unknown;
  to?: unknown;
  next?: unknown;
}) {
  return (args: FindFirstArgs) => {
    const where = args.where ?? {};
    if (where.startsAt) return Promise.resolve(opts.next ?? null);
    if (where.id === fromYear.id) return Promise.resolve(opts.from ?? null);
    if (where.id === toYear.id) return Promise.resolve(opts.to ?? null);
    return Promise.resolve(null);
  };
}

describe('PromotionService', () => {
  let service: PromotionService;
  const prismaMock = {
    academicYear: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    promotionLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    classSection: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    enrollment: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    teacherClassSection: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const cacheMock = { set: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
    );
    // Sensible defaults so unrelated branches do not explode.
    prismaMock.teacherClassSection.findMany.mockResolvedValue([]);
    prismaMock.teacherClassSection.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CACHE_MANAGER, useValue: cacheMock },
        AcademicYearCacheRef,
      ],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
  });

  it('promoteAcademicYear success: creates classrooms and enrollments, writes log', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.classSection.findMany
      .mockResolvedValueOnce([
        {
          id: 'cs1',
          grade: 'GRADE_6',
          section: 'A',
          label: '6.A',
          teacherId: 'teacher-1',
        },
      ])
      .mockResolvedValueOnce([{ id: 'cs-new-1', grade: 'GRADE_7', section: 'A' }]);
    prismaMock.classSection.createMany.mockResolvedValue({ count: 1 });
    prismaMock.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', classSectionId: 'cs1' },
    ]);
    prismaMock.enrollment.createMany.mockResolvedValue({ count: 1 });
    prismaMock.promotionLog.create.mockResolvedValue({});

    const result = await service.promoteAcademicYear(
      'org-1',
      fromYear.id,
      toYear.id,
      directorUser,
    );

    expect(result).toEqual({
      fromYearId: fromYear.id,
      toYearId: toYear.id,
      classroomsCreated: 1,
      studentsEnrolled: 1,
      durationMs: expect.any(Number),
    });
    expect(prismaMock.promotionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        fromYearId: fromYear.id,
        toYearId: toYear.id,
        executedBy: directorUser.userId,
        classesCreatedCount: 1,
        studentsMigratedCount: 1,
        enrollmentsSkippedCount: 0,
        skippedClassesCount: 0,
      }),
    });
    expect(cacheMock.set).toHaveBeenCalled();
  });

  it('copies explicit teacher-to-class assignments onto the promoted sections', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.classSection.findMany
      .mockResolvedValueOnce([
        { id: 'cs1', grade: 'GRADE_6', section: 'A', label: '6.A', teacherId: null },
      ])
      .mockResolvedValueOnce([{ id: 'cs-new-1', grade: 'GRADE_7', section: 'A' }]);
    prismaMock.classSection.createMany.mockResolvedValue({ count: 1 });
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.enrollment.createMany.mockResolvedValue({ count: 0 });
    prismaMock.teacherClassSection.findMany.mockResolvedValue([
      { teacherId: 'teacher-1', classSectionId: 'cs1' },
    ]);
    prismaMock.teacherClassSection.createMany.mockResolvedValue({ count: 1 });
    prismaMock.promotionLog.create.mockResolvedValue({});

    await service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser);

    expect(prismaMock.teacherClassSection.createMany).toHaveBeenCalledWith({
      data: [
        { teacherId: 'teacher-1', classSectionId: 'cs-new-1', yearId: toYear.id },
      ],
      skipDuplicates: true,
    });
  });

  it('promoteAcademicYear duplicate: throws Conflict when promotion log exists', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue({ id: 'log-1' });

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.promotionLog.findUnique).toHaveBeenCalled();
  });

  it('promoteAcademicYear missing next year: throws Conflict when there is no following year', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: null }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear wrong next year: throws Conflict when toYearId is not the immediate next', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: { id: 'other-year-id' } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear year not ended: throws Conflict when fromYear.endsAt is in future', async () => {
    const futureYear = { ...fromYear, endsAt: new Date(Date.now() + 86400000) };
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: futureYear, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear unauthorized: throws Forbidden for TEACHER', async () => {
    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, teacherUser),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear records enrollmentsSkippedCount when createMany skips duplicates', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.classSection.findMany
      .mockResolvedValueOnce([
        { id: 'cs1', grade: 'GRADE_6', section: 'A', label: '6.A', teacherId: null },
      ])
      .mockResolvedValueOnce([{ id: 'cs-new-1', grade: 'GRADE_7', section: 'A' }]);
    prismaMock.classSection.createMany.mockResolvedValue({ count: 1 });
    prismaMock.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', classSectionId: 'cs1' },
      { studentId: 's2', classSectionId: 'cs1' },
    ]);
    prismaMock.enrollment.createMany.mockResolvedValue({ count: 1 });

    const result = await service.promoteAcademicYear(
      'org-1',
      fromYear.id,
      toYear.id,
      directorUser,
    );

    expect(result.studentsEnrolled).toBe(1);
    expect(prismaMock.promotionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentsMigratedCount: 1,
        enrollmentsSkippedCount: 1,
      }),
    });
  });

  it('promoteAcademicYear from year not found: throws NotFound', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: null, to: toYear, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('promoteAcademicYear to year not found: throws NotFound', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: fromYear, to: null, next: { id: toYear.id } }),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('getPromotionStatus returns promoted and toYearId when log exists', async () => {
    prismaMock.promotionLog.findUnique.mockResolvedValue({ toYearId: toYear.id });

    const status = await service.getPromotionStatus('org-1', fromYear.id, directorUser);

    expect(status).toEqual({ promoted: true, toYearId: toYear.id });
  });

  it('getPromotionStatus returns not promoted when no log', async () => {
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    const status = await service.getPromotionStatus('org-1', fromYear.id, directorUser);

    expect(status).toEqual({ promoted: false });
  });

  it('getNextAcademicYear returns next year by startsAt', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({
        from: { startsAt: fromYear.startsAt },
        next: { id: toYear.id, label: toYear.label },
      }),
    );

    const next = await service.getNextAcademicYear('org-1', fromYear.id);

    expect(next).toEqual({ id: toYear.id, label: toYear.label });
  });

  it('getNextAcademicYear returns null when no next year', async () => {
    prismaMock.academicYear.findFirst.mockImplementation(
      makeFindFirst({ from: { startsAt: fromYear.startsAt }, next: null }),
    );

    const next = await service.getNextAcademicYear('org-1', fromYear.id);

    expect(next).toBeNull();
  });
});
