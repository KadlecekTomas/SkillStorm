import { Test } from '@nestjs/testing';
import { SchoolGrade, SystemRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { OrgContextService } from '@/common/org-context/org-context.service';
import type { RequestWithUser } from '@/types/request-with-user';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';
import type { CreateClassSectionDto } from './dto/create-classroom.dto';
import type { QueryClassSectionsDto } from './dto/query-class-sections.dto';

describe('ClassSectionsController', () => {
  let controller: ClassSectionsController;
  let service: ClassSectionsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setHomeroom: jest.fn(),
  };

  // Controller resolves the active academic year through OrgContextService and
  // injects it into the service call; tests need a functional get().
  const mockOrgContext = { get: jest.fn() };

  beforeEach(async () => {
    // Re-applied each test because afterEach(resetAllMocks) clears implementations.
    mockOrgContext.get.mockResolvedValue({
      organizationId: 'org-1',
      activeAcademicYearId: 'year-1',
    });

    const module = await Test.createTestingModule({
      controllers: [ClassSectionsController],
      providers: [
        { provide: ClassSectionsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
        // Required by RequireCurrentAcademicYearGuard / AcademicYearExpiredGuard.
        { provide: AcademicYearsService, useValue: {} },
        AcademicYearCacheRef,
        { provide: OrgContextService, useValue: mockOrgContext },
      ],
    }).compile();

    controller = module.get(ClassSectionsController);
    service = module.get(ClassSectionsService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create() volej service s DTO', async () => {
    const dto: CreateClassSectionDto = {
      yearId: 'year-1',
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A',
    };
    const created = { id: 'cls-1', ...dto };
    mockService.create.mockResolvedValue(created);

    const req = {
      user: {
        userId: 'user-1',
        email: 'user@example.com',
        systemRole: SystemRole.SUPERADMIN,
        organizationId: 'org-1',
      },
    } as RequestWithUser;

    const res = await controller.create(dto, req);
    // Controller injects the active academic year resolved from OrgContext.
    expect(service.create).toHaveBeenCalledWith(
      { ...dto, yearId: 'year-1', academicYearId: 'year-1' },
      req.user,
    );
    if (!res.success) throw new Error('expected a success envelope');
    expect(await res.data).toEqual(created);
  });

  it('findAll() vrací list', async () => {
    const req = {
      user: {
        userId: 'user-1',
        email: 'user@example.com',
        systemRole: SystemRole.SUPERADMIN,
        organizationId: 'org-1',
      },
    } as RequestWithUser;
    const query: QueryClassSectionsDto = {};

    mockService.findAll.mockResolvedValue([{ id: 'cls-1' }]);
    const res = await controller.findAll(req, query);
    // Empty query → controller falls back to the active academic year.
    expect(service.findAll).toHaveBeenCalledWith(
      { ...query, yearId: 'year-1', academicYearId: 'year-1' },
      req.user,
    );
    if (!res.success) throw new Error('expected a success envelope');
    expect(await res.data).toEqual([{ id: 'cls-1' }]);
  });
});
