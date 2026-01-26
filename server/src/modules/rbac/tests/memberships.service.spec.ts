import { MembershipsService } from '@/memberships/memberships.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { SystemRole, OrganizationRole } from '@prisma/client';
import { emitRbacInvalidation } from '@/modules/rbac/rbac.events';

jest.mock('@/modules/rbac/rbac.events', () => ({
  emitRbacInvalidation: jest.fn(),
}));

jest.mock('@/shared/cache/org-cache.utils', () => {
  const actual = jest.requireActual('@/shared/cache/org-cache.utils');
  return {
    ...actual,
    bumpOrgVersion: jest.fn(),
  };
});

describe('MembershipsService RBAC side-effects', () => {
  let service: MembershipsService;
  let prismaMock: any;
  let cache: any;

  beforeEach(() => {
    prismaMock = {
      organization: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      membership: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    cache = { get: jest.fn(), set: jest.fn() };
    service = new MembershipsService(prismaMock as PrismaService, cache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates audit log and emits invalidation on role change', async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'u-1',
      organizationId: 'org-1',
      role: OrganizationRole.TEACHER,
    } as any);
    prismaMock.membership.update.mockResolvedValue({
      id: 'm-1',
      userId: 'u-1',
      organizationId: 'org-1',
      role: OrganizationRole.DIRECTOR,
    } as any);

    await service.update(
      'm-1',
      { role: OrganizationRole.DIRECTOR },
      { systemRole: SystemRole.SUPERADMIN },
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MEMBERSHIP_ROLE_CHANGE',
          entityId: 'm-1',
          metadata: expect.objectContaining({
            previousRole: OrganizationRole.TEACHER,
            nextRole: OrganizationRole.DIRECTOR,
          }),
        }),
      }),
    );
    expect(emitRbacInvalidation).toHaveBeenCalledWith({
      userId: 'u-1',
      organizationId: 'org-1',
      reason: 'MEMBERSHIP_ROLE_CHANGE',
    });
  });
});
