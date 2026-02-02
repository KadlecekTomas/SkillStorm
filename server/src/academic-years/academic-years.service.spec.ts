import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService } from './academic-years.service';

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  const prismaMock = {
    academicYear: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaMock.academicYear.count.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AcademicYearsService>(AcademicYearsService);
  });

  it('throws conflict when multiple active academic years exist', async () => {
    prismaMock.academicYear.count.mockResolvedValue(2);

    await expect(
      service.assertOrgHasExactlyOneActiveYear('org-1'),
    ).rejects.toMatchObject({
      response: {
        meta: { code: 'MULTIPLE_ACTIVE_ACADEMIC_YEARS' },
      },
    });
  });
});
