import { AuditEntityType, Prisma } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService critical write contract', () => {
  function makeService() {
    const prisma = {
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;
    return { prisma, service: new AuditService(prisma) };
  }

  it('fails closed when the audit insert fails', async () => {
    const { prisma, service } = makeService();
    const create = prisma.auditLog.create as jest.Mock;
    create.mockRejectedValue(new Error('audit insert failed'));

    await expect(
      service.log({
        action: 'USER_PERMISSION_GRANTED',
        entityType: AuditEntityType.PERMISSION,
        entityId: 'permission-row',
        userId: 'actor-user',
        organizationId: 'org-a',
      }),
    ).rejects.toThrow('audit insert failed');
  });

  it('uses the supplied transaction client and sanitizes forensic data before write', async () => {
    const { prisma, service } = makeService();
    const txCreate = jest.fn().mockResolvedValue({ id: 'audit-row' });
    const tx = {
      auditLog: { create: txCreate },
    } as unknown as Prisma.TransactionClient;

    await service.log(
      {
        action: 'MEMBERSHIP_PRIMARY_ROLE_CHANGE',
        entityType: AuditEntityType.PERMISSION,
        entityId: 'membership-a',
        userId: 'actor-user',
        organizationId: 'org-a',
        metadata: {
          previousRole: 'TEACHER',
          nextRole: 'DIRECTOR',
          temporaryPassword: 'never-store-this',
        },
        changedFields: {
          role: 'DIRECTOR',
          passwordHash: 'never-store-this-either',
        },
      },
      tx,
    );

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(txCreate).toHaveBeenCalledTimes(1);
    const call = txCreate.mock.calls[0]?.[0];
    expect(call.data.metadata).toEqual({
      previousRole: 'TEACHER',
      nextRole: 'DIRECTOR',
    });
    expect(call.data.changedFields).toEqual(['role']);
    expect(JSON.stringify(call)).not.toContain('never-store-this');
  });

  it('returns changedFields in forensic queries', async () => {
    const { prisma, service } = makeService();
    (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'actor',
        organizationId: 'org-a',
        systemRole: null,
        entityType: AuditEntityType.USER,
        entityId: 'target',
        action: 'STUDENT_ADMIN_UPDATE',
        ipAddress: null,
        userAgent: null,
        metadata: null,
        changedFields: ['email', 'name'],
        createdAt: new Date('2026-08-22T00:00:00.000Z'),
      },
    ]);

    const result = await service.query({ organizationId: 'org-a' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.changedFields).toEqual(['email', 'name']);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a' },
        select: expect.objectContaining({ changedFields: true }),
      }),
    );
  });
});
