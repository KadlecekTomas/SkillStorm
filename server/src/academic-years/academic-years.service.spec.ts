import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import {
  AcademicYearsService,
  MULTIPLE_CURRENT_YEARS_FOR_ORG,
  NO_CURRENT_ACADEMIC_YEAR,
} from './academic-years.service';

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  const prismaMock = {
    academicYear: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: any) => any) => fn(prismaMock));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearsService,
        { provide: PrismaService, useValue: prismaMock },
        // Dependency-free in-memory cache; real instance is safe in tests.
        AcademicYearCacheRef,
      ],
    }).compile();

    service = module.get<AcademicYearsService>(AcademicYearsService);
  });

  it('throws conflict when no current academic year exists', async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null);

    await expect(
      service.getCurrentForOrgOrFail('org-1'),
    ).rejects.toMatchObject({
      response: {
        meta: { code: NO_CURRENT_ACADEMIC_YEAR },
      },
    });
  });

  it('returns the current non-deleted academic year deterministically', async () => {
    const currentYear = {
      id: 'year-2',
      orgId: 'org-1',
      label: '2026/2027',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-08-31T00:00:00.000Z'),
      isCurrent: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prismaMock.academicYear.findFirst.mockResolvedValue(currentYear);

    await expect(service.getCurrentForOrgOrFail('org-1')).resolves.toMatchObject({
      id: currentYear.id,
      organizationId: currentYear.orgId,
      isActive: true,
    });
    expect(prismaMock.academicYear.findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', isCurrent: true, deletedAt: null },
      orderBy: { startsAt: 'desc' },
    });
  });

  it('activate() converts P2002 unique constraint to MULTIPLE_CURRENT_YEARS_FOR_ORG (concurrency)', async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: 'year-1',
      orgId: 'org-1',
    });
    prismaMock.academicYear.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.academicYear.update.mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );

    await expect(
      service.activate('year-1', {
        userId: 'u1',
        organizationId: 'org-1',
        systemRole: 'TEACHER',
      } as any),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.activate('year-1', {
        userId: 'u1',
        organizationId: 'org-1',
        systemRole: 'TEACHER',
      } as any),
    ).rejects.toMatchObject({
      response: {
        code: MULTIPLE_CURRENT_YEARS_FOR_ORG,
        message: 'Another academic year was set as current concurrently.',
      },
    });
  });
});
