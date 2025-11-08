import { PermissionKey, SystemRole } from '@prisma/client';
import { RbacService } from './rbac.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { emitRbacInvalidation } from './rbac.events';

describe('RbacService', () => {
  let prisma: any;
  let service: RbacService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      userPermission: { findFirst: jest.fn() },
      membership: { findFirst: jest.fn() },
      rolePermission: { findFirst: jest.fn() },
    };
    service = new RbacService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    service.invalidateAll();
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('grants access immediately to system superadmins and caches the result', async () => {
    prisma.user.findUnique.mockResolvedValue({
      systemRole: SystemRole.SUPERADMIN,
    } as any);

    const allowed = await service.canUser(
      'user-super',
      null,
      PermissionKey.CREATE_TEST,
    );

    expect(allowed).toBe(true);
    expect(prisma.userPermission.findFirst).not.toHaveBeenCalled();

    // second call should hit cache – no extra Prisma lookups
    await service.canUser('user-super', null, PermissionKey.CREATE_TEST);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached permissions per user', async () => {
    prisma.user.findUnique.mockResolvedValue({ systemRole: null } as any);
    prisma.userPermission.findFirst.mockResolvedValue(null);
    prisma.membership.findFirst.mockResolvedValue({
      role: 'TEACHER',
      organizationId: 'org-1',
    } as any);
    prisma.rolePermission.findFirst.mockResolvedValueOnce({} as any);
    prisma.rolePermission.findFirst.mockResolvedValueOnce(null);

    const first = await service.canUser(
      'user-1',
      'org-1',
      PermissionKey.CREATE_TEST,
    );
    expect(first).toBe(true);

    // Cached response should still be true although Prisma would now return false
    const cached = await service.canUser(
      'user-1',
      'org-1',
      PermissionKey.CREATE_TEST,
    );
    expect(cached).toBe(true);

    service.invalidateUser('user-1');
    const afterInvalidation = await service.canUser(
      'user-1',
      'org-1',
      PermissionKey.CREATE_TEST,
    );
    expect(afterInvalidation).toBe(false);
  });

  it('responds to global RBAC invalidation events', async () => {
    prisma.user.findUnique.mockResolvedValue({ systemRole: null } as any);
    prisma.userPermission.findFirst.mockResolvedValue(null);
    prisma.membership.findFirst.mockResolvedValue({
      role: 'TEACHER',
      organizationId: 'org-shared',
    } as any);
    prisma.rolePermission.findFirst.mockResolvedValue({} as any);

    await service.canUser('user-x', 'org-shared', PermissionKey.VIEW_RESULTS);
    expect(prisma.rolePermission.findFirst).toHaveBeenCalledTimes(1);

    emitRbacInvalidation({ organizationId: 'org-shared' });
    prisma.rolePermission.findFirst.mockResolvedValueOnce(null);

    const result = await service.canUser(
      'user-x',
      'org-shared',
      PermissionKey.VIEW_RESULTS,
    );
    expect(result).toBe(false);
  });
});
