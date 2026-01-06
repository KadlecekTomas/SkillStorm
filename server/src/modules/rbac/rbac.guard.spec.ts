import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionKey, SystemRole } from '@prisma/client';
import { RbacGuard } from './rbac.guard';
import type { RbacService } from './rbac.service';

describe('RbacGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const rbacService = {
    canUser: jest.fn(),
  } as unknown as RbacService;

  const guard = new RbacGuard(reflector, rbacService);

  const makeContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params: {}, query: {}, body: {} }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows public routes when no permissions are defined', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const ctx = makeContext({ userId: 'user-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows access when system role satisfies permission token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      SystemRole.SUPERADMIN,
    ]);
    const ctx = makeContext({
      userId: 'user-1',
      systemRole: SystemRole.SUPERADMIN,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('delegates to RbacService when PermissionKey metadata is set', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      PermissionKey.CREATE_TEST,
    ]);
    (rbacService.canUser as jest.Mock).mockResolvedValue(true);
    const ctx = makeContext({
      userId: 'user-1',
      organizationId: 'org-1',
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(rbacService.canUser).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      PermissionKey.CREATE_TEST,
    );
  });

  it('throws ForbiddenException when permissions are missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      PermissionKey.MANAGE_STUDENTS,
    ]);
    (rbacService.canUser as jest.Mock).mockResolvedValue(false);
    const ctx = makeContext({
      userId: 'user-2',
      organizationId: 'org-2',
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
