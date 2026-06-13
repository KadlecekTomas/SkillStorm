import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { StudentDiagnosticService } from '@/analytics/student-diagnostic.service';
import { StudentsController } from './student.controller';
import { StudentsService } from './student.service';

describe('StudentsController', () => {
  let controller: StudentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        // Required by RequireCurrentAcademicYearGuard / AcademicYearExpiredGuard.
        { provide: AcademicYearsService, useValue: {} },
        AcademicYearCacheRef,
        { provide: StudentDiagnosticService, useValue: {} },
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
