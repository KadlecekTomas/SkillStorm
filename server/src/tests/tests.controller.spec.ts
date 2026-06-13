import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

describe('TestsController', () => {
  let controller: TestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestsController],
      providers: [
        TestsService,
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
        // Required by RequireCurrentAcademicYearGuard / AcademicYearExpiredGuard.
        { provide: AcademicYearsService, useValue: {} },
        AcademicYearCacheRef,
        { provide: OrgContextService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TestsController>(TestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
