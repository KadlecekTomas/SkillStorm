import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { MembershipsService } from './memberships.service';

jest.mock('@/shared/cache/org-cache.utils', () => ({
  buildVersionedListKey: jest.fn(),
  cacheGetOrSet: jest.fn(),
  getOrgVersion: jest.fn().mockResolvedValue('1'),
  bumpOrgVersion: jest.fn().mockResolvedValue(undefined),
  makeUserSearch: jest.fn(),
}));

jest.mock('@/modules/rbac/rbac.events', () => ({
  emitRbacInvalidation: jest.fn(),
}));

describe('MembershipsService', () => {
  let service: MembershipsService;
  const prisma = {
    membership: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teacher: { findMany: jest.fn(), updateMany: jest.fn() },
    student: { updateMany: jest.fn() },
    classSection: { updateMany: jest.fn() },
    teacherSubject: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('remove → soft delete membership a navázané teacher/student', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      role: 'TEACHER',
      userId: 'u1',
      deletedAt: null,
    });
    prisma.membership.update.mockResolvedValue({ id: 'm1' });
    prisma.teacher.findMany.mockResolvedValue([{ id: 't1' }]);
    prisma.teacher.updateMany.mockResolvedValue({ count: 1 });
    prisma.student.updateMany.mockResolvedValue({ count: 1 });
    prisma.classSection.updateMany.mockResolvedValue({ count: 1 });
    prisma.teacherSubject.deleteMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({});

    await service.remove('m1', {
      userId: 'admin',
      organizationId: 'org1',
      systemRole: 'SUPERADMIN',
    });

    expect(prisma.membership.update).toHaveBeenCalled();
    expect(prisma.teacher.updateMany).toHaveBeenCalled();
    expect(prisma.student.updateMany).toHaveBeenCalled();
  });
});
