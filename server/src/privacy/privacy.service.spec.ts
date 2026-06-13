import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { PrivacyService } from './privacy.service';

describe('PrivacyService.anonymizeUser', () => {
  let service: PrivacyService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      findMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    userIdentity: {
      deleteMany: jest.fn(),
    },
    submission: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', anonymized: false });
    prismaMock.membership.findMany.mockResolvedValue([{ id: 'membership-1' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrivacyService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(PrivacyService);
  });

  it('invalidates all live sessions: bumps tokenVersion and revokes refresh tokens', async () => {
    await service.anonymizeUser('user-1', 'admin-1');

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          anonymized: true,
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('hard-deletes external SSO identities (PII must not survive anonymization)', async () => {
    await service.anonymizeUser('user-1', 'admin-1');

    expect(prismaMock.userIdentity.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('is idempotent for already anonymized users', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', anonymized: true });

    await service.anonymizeUser('user-1', 'admin-1');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
