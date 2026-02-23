import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
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
    $transaction: jest.fn(),
  };

  const cacheMock = { set: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CACHE_MANAGER, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
  });

  it('promoteAcademicYear success: creates classrooms and enrollments, writes log', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: toYear.id });
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
      .mockResolvedValueOnce([
        { id: 'cs-new-1', grade: 'GRADE_7', section: 'A' },
      ]);
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

  it('promoteAcademicYear duplicate: throws Conflict when promotion log exists', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: toYear.id });
    prismaMock.promotionLog.findUnique.mockResolvedValue({ id: 'log-1' });

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.promotionLog.findUnique).toHaveBeenCalled();
  });

  it('promoteAcademicYear missing next year: throws Conflict when toYear is not immediate next', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.academicYear.findFirst.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear wrong next year: throws Conflict when toYearId is not the immediate next', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: 'other-year-id' });

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear year not ended: throws Conflict when fromYear.endsAt is in future', async () => {
    const futureYear = {
      ...fromYear,
      endsAt: new Date(Date.now() + 86400000),
    };
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(futureYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: toYear.id });

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, directorUser),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear unauthorized: throws Forbidden for TEACHER', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, toYear.id, teacherUser),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('promoteAcademicYear records enrollmentsSkippedCount when createMany skips duplicates', async () => {
    prismaMock.academicYear.findUnique
      .mockResolvedValueOnce(fromYear)
      .mockResolvedValueOnce(toYear);
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: toYear.id });
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);
    prismaMock.classSection.findMany
      .mockResolvedValueOnce([
        {
          id: 'cs1',
          grade: 'GRADE_6',
          section: 'A',
          label: '6.A',
          teacherId: null,
        },
      ])
      .mockResolvedValueOnce([
        { id: 'cs-new-1', grade: 'GRADE_7', section: 'A' },
      ]);
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
    prismaMock.academicYear.findUnique.mockReset();
    prismaMock.academicYear.findUnique.mockImplementation((args: { where: { id: string } }) => {
      if (args.where.id === 'nonexistent') return Promise.resolve(null);
      if (args.where.id === toYear.id) return Promise.resolve(toYear);
      return Promise.resolve(null);
    });
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', 'nonexistent', toYear.id, directorUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('promoteAcademicYear to year not found: throws NotFound', async () => {
    prismaMock.academicYear.findUnique.mockImplementation((args: { where: { id: string } }) =>
      Promise.resolve(args.where.id === fromYear.id ? fromYear : null),
    );
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    await expect(
      service.promoteAcademicYear('org-1', fromYear.id, 'nonexistent', directorUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('getPromotionStatus returns promoted and toYearId when log exists', async () => {
    prismaMock.promotionLog.findUnique.mockResolvedValue({ toYearId: toYear.id });

    const status = await service.getPromotionStatus(
      'org-1',
      fromYear.id,
      directorUser,
    );

    expect(status).toEqual({ promoted: true, toYearId: toYear.id });
  });

  it('getPromotionStatus returns not promoted when no log', async () => {
    prismaMock.promotionLog.findUnique.mockResolvedValue(null);

    const status = await service.getPromotionStatus(
      'org-1',
      fromYear.id,
      directorUser,
    );

    expect(status).toEqual({ promoted: false });
  });

  it('getNextAcademicYear returns next year by startsAt', async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: fromYear.id,
      startsAt: fromYear.startsAt,
    });
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: toYear.id,
      label: toYear.label,
    });

    const next = await service.getNextAcademicYear('org-1', fromYear.id);

    expect(next).toEqual({ id: toYear.id, label: toYear.label });
  });

  it('getNextAcademicYear returns null when no next year', async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue(fromYear);
    prismaMock.academicYear.findFirst.mockResolvedValue(null);

    const next = await service.getNextAcademicYear('org-1', fromYear.id);

    expect(next).toBeNull();
  });
});
