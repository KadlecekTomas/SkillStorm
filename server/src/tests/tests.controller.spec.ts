import { NotFoundException } from '@nestjs/common';
import { OrganizationRole, PublishStatus } from '@prisma/client';
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
  let service: TestsService;

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
    service = module.get<TestsService>(TestsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('hides an unpublished colleague test from the teacher read-only route', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: PublishStatus.DRAFT, editMode: 'NONE' });
    const req = { user: { organizationRole: OrganizationRole.TEACHER } } as Parameters<TestsController['viewOne']>[1];
    await expect(controller.viewOne('11111111-1111-4111-8111-111111111111', req)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a published colleague test through the teacher read-only route', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', status: PublishStatus.PUBLISHED, editMode: 'NONE' });
    const req = { user: { organizationRole: OrganizationRole.TEACHER } } as Parameters<TestsController['viewOne']>[1];
    await expect(controller.viewOne('22222222-2222-4222-8222-222222222222', req)).resolves.toBeDefined();
  });
});
