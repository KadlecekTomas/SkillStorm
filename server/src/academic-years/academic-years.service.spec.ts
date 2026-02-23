import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService, MULTIPLE_CURRENT_YEARS_FOR_ORG } from './academic-years.service';

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  const prismaMock = {
    academicYear: {
      count: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AcademicYearsService>(AcademicYearsService);
  });

  it('throws conflict when multiple current academic years exist (assertOrgHasExactlyOneCurrentYear)', async () => {
    prismaMock.academicYear.count.mockResolvedValue(2);

    await expect(
      service.assertOrgHasExactlyOneCurrentYear('org-1'),
    ).rejects.toMatchObject({
      response: {
        meta: { code: 'MULTIPLE_CURRENT_ACADEMIC_YEARS' },
      },
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
