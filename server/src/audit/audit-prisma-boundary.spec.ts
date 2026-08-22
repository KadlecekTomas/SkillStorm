import { PrismaService } from '@/prisma/prisma.service';

describe('PrismaService AuditLog boundary', () => {
  it('sanitizes direct AuditLog.create writes that bypass AuditService', async () => {
    const prisma = new PrismaService();
    const next = jest.fn(async (params) => params);
    const middleware = (prisma as any).sanitizeAuditLogWrites as (
      params: any,
      nextFn: (params: any) => Promise<any>,
    ) => Promise<any>;
    const params = {
      model: 'AuditLog',
      action: 'create',
      args: {
        data: {
          action: 'DIRECT_WRITE',
          metadata: {
            role: 'TEACHER',
            temporaryPassword: 'do-not-store',
            before: { accessToken: 'secret-access', safeId: 'safe-id' },
          },
          changedFields: {
            email: 'alice@example.test',
            passwordHash: 'secret-hash',
          },
        },
      },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(params.args.data.metadata).toEqual({
      role: 'TEACHER',
      before: { safeId: 'safe-id' },
    });
    expect(params.args.data.changedFields).toEqual(['email']);
    expect(JSON.stringify(params)).not.toContain('do-not-store');
    expect(JSON.stringify(params)).not.toContain('secret-access');
    expect(JSON.stringify(params)).not.toContain('secret-hash');
    await prisma.$disconnect();
  });

  it('blocks AuditLog.upsert as an append-only bypass', async () => {
    const prisma = new PrismaService();
    const next = jest.fn();
    const middleware = (prisma as any).enforceAuditLogImmutability as (
      params: any,
      nextFn: (params: any) => Promise<any>,
    ) => Promise<any>;

    await expect(
      middleware(
        {
          model: 'AuditLog',
          action: 'upsert',
          args: {
            where: { id: 'audit-row' },
            create: {},
            update: { action: 'rewritten' },
          },
        },
        next,
      ),
    ).rejects.toThrow(/immutable/i);
    expect(next).not.toHaveBeenCalled();
    await prisma.$disconnect();
  });
});
