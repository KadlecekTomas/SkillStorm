import { PermissionKey, SystemRole } from '@prisma/client';
import { RbacService } from '@/modules/rbac/rbac.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { RbacInvalidatePayload } from '@/modules/rbac/rbac.events';
import { emitRbacInvalidation } from '@/modules/rbac/rbac.events';

jest.mock('@/modules/rbac/rbac.events', () => {
  const { EventEmitter } = require('events');
  const rbacEvents = new EventEmitter();
  rbacEvents.setMaxListeners(50);
  const RBAC_INVALIDATE_EVENT = 'rbac.invalidate';
  return {
    RBAC_INVALIDATE_EVENT,
    rbacEvents,
    emitRbacInvalidation: (payload: RbacInvalidatePayload) =>
      rbacEvents.emit(RBAC_INVALIDATE_EVENT, payload),
  };
});

describe('RbacService (unit)', () => {
  let prismaMock: any;
  let service: RbacService;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn() },
      userPermission: { findFirst: jest.fn() },
      membership: { findFirst: jest.fn() },
      rolePermission: { findFirst: jest.fn() },
    };
    service = new RbacService(prismaMock as PrismaService);
  });

  afterEach(() => {
    service.invalidateAll();
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('grants permissions to SUPERADMIN without hitting membership lookups', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      systemRole: SystemRole.SUPERADMIN,
    } as any);

    const allowed = await service.canUser(
      'super-1',
      null,
      PermissionKey.DELETE_TEST,
    );

    expect(allowed).toBe(true);
    expect(prismaMock.userPermission.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
  });

  it('caches permission decisions and invalidates on organization events', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: null } as any);
    prismaMock.userPermission.findFirst.mockResolvedValue(null);
    prismaMock.membership.findFirst.mockResolvedValue({
      role: 'TEACHER',
      organizationId: 'org-1',
    } as any);
    prismaMock.rolePermission.findFirst.mockResolvedValue({ allowed: true });

    const first = await service.canUser(
      'user-1',
      'org-1',
      PermissionKey.DELETE_TEST,
    );
    expect(first).toBe(true);
    expect(prismaMock.rolePermission.findFirst).toHaveBeenCalledTimes(1);

    await service.canUser('user-1', 'org-1', PermissionKey.DELETE_TEST);
    expect(prismaMock.rolePermission.findFirst).toHaveBeenCalledTimes(1);

    emitRbacInvalidation({ organizationId: 'org-1' });
    // Org-scoped lookup answers definitively (allowed: false); a bare `null`
    // would fall through to the org-null fallback query and hit the base
    // mock's `allowed: true` again (canUser does `orgScoped ?? global`).
    prismaMock.rolePermission.findFirst.mockResolvedValueOnce({
      allowed: false,
    });
    const afterInvalidation = await service.canUser(
      'user-1',
      'org-1',
      PermissionKey.DELETE_TEST,
    );
    expect(prismaMock.rolePermission.findFirst).toHaveBeenCalledTimes(2);
    expect(afterInvalidation).toBe(false);
  });

  it('invalidates cache when userId changes permissions', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ systemRole: null } as any);
    prismaMock.userPermission.findFirst.mockResolvedValue(null);
    prismaMock.membership.findFirst.mockResolvedValue({
      role: 'STUDENT',
      organizationId: 'org-2',
    } as any);
    prismaMock.rolePermission.findFirst.mockResolvedValue(null);

    const first = await service.canUser(
      'user-2',
      'org-2',
      PermissionKey.CREATE_TEST,
    );
    expect(first).toBe(false);

    prismaMock.userPermission.findFirst.mockResolvedValueOnce({
      id: 'up-1',
    } as any);
    emitRbacInvalidation({ userId: 'user-2' });
    const second = await service.canUser(
      'user-2',
      'org-2',
      PermissionKey.CREATE_TEST,
    );
    expect(second).toBe(true);
  });

});
