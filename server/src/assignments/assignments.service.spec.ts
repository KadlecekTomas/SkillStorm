import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AssignmentsService } from './assignments.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { SubmissionsService } from '@/submissions/submissions.service';
import * as cacheUtils from '@/shared/cache/org-cache.utils';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  const prisma = {
    submission: { count: jest.fn() },
    assignment: { delete: jest.fn(), update: jest.fn() },
  };
  const cache = {};
  const rbac = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacService, useValue: rbac },
        { provide: SubmissionsService, useValue: { create: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  it('remove → 409 pokud má assignment submissions', async () => {
    prisma.submission.count.mockResolvedValue(1);
    await expect(service.remove('a1', { organizationId: 'org-1' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.assignment.delete).not.toHaveBeenCalled();
  });

  it('remove → hard delete pokud submissions neexistují', async () => {
    jest
      .spyOn(service, 'findOneOrThrowScoped')
      .mockResolvedValue({ id: 'a1', organizationId: 'org-1' } as any);
    const invalidateSpy = jest
      .spyOn(cacheUtils, 'invalidateResourcesFailSafe')
      .mockResolvedValue(undefined);
    prisma.submission.count.mockResolvedValue(0);
    prisma.assignment.delete.mockResolvedValue({ id: 'a1' });
    await service.remove('a1', { organizationId: 'org-1' } as any);
    expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(invalidateSpy).toHaveBeenCalledWith(
      cache,
      expect.objectContaining({
        scopeId: 'org-1',
        resources: ['assignments', 'dashboard'],
        mutation: 'assignments.remove',
      }),
    );
  });

  it('update invalidates assignments + dashboard', async () => {
    jest
      .spyOn(service, 'findOneOrThrowScoped')
      .mockResolvedValue({
        id: 'a1',
        organizationId: 'org-1',
        yearId: 'year-1',
        openAt: new Date('2026-04-11T08:00:00.000Z'),
        closeAt: new Date('2026-04-11T09:00:00.000Z'),
      } as any);
    const invalidateSpy = jest
      .spyOn(cacheUtils, 'invalidateResourcesFailSafe')
      .mockResolvedValue(undefined);
    prisma.assignment.update.mockResolvedValue({ id: 'a1' });

    await service.update(
      'a1',
      { shuffle: true },
      { organizationId: 'org-1' } as any,
    );

    expect(invalidateSpy).toHaveBeenCalledWith(
      cache,
      expect.objectContaining({
        scopeId: 'org-1',
        resources: ['assignments', 'dashboard'],
        mutation: 'assignments.update',
      }),
    );
  });
});
