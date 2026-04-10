import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import {
  OrganizationsService,
  ORG_OWNER_LIMIT_REACHED,
  ORG_CREATE_IDEMPOTENCY_KEY_REUSED,
} from './organizations.service';
import { OrganizationStatus, OrganizationType, OrganizationRole } from '@prisma/client';
import { bumpOrgVersion } from '@/shared/cache/org-cache.utils';
import { createHash } from 'crypto';

jest.mock('@/shared/cache/org-cache.utils', () => ({
  buildVersionedListKey: jest.fn(),
  cacheGetOrSet: jest.fn(),
  getOrgVersion: jest.fn(),
  bumpOrgVersion: jest.fn().mockResolvedValue(undefined),
}));

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    idempotencyKey: { findUnique: jest.Mock };
    organization: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  const hashPayload = (name: string, type: OrganizationType) =>
    createHash('sha256')
      .update(
        JSON.stringify({
          name,
          address: '',
          city: '',
          country: '',
          type,
        }),
      )
      .digest('hex');

  it('returns existing organization for the same idempotency key replay', async () => {
    const existingOrg = {
      id: 'org-1',
      name: 'Replay Org',
      address: null,
      city: null,
      country: null,
      type: OrganizationType.SCHOOL,
      status: OrganizationStatus.PENDING,
      ownerUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'req-1',
      requestHash: hashPayload('Replay Org', OrganizationType.SCHOOL),
      result: existingOrg,
    });

    const result = await service.create(
      { name: 'Replay Org', type: OrganizationType.SCHOOL },
      'user-1',
      'idem-1',
    );

    expect(result).toEqual(existingOrg);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reusing the same idempotency key with a different payload', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'req-1',
      requestHash:
        'different-hash',
      result: {
        id: 'org-1',
        deletedAt: null,
      },
    });

    await expect(
      service.create(
        { name: 'Payload A', type: OrganizationType.SCHOOL },
        'user-1',
        'idem-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: ORG_CREATE_IDEMPOTENCY_KEY_REUSED,
      }),
    });
  });

  it('stores replay result and keeps non-critical cache update outside the transaction', async () => {
    const createdOrg = {
      id: 'org-1',
      name: 'Audit Failure Org',
      address: null,
      city: null,
      country: null,
      type: OrganizationType.SCHOOL,
      status: OrganizationStatus.PENDING,
      ownerUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const tx = {
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'req-1' }),
        update: jest.fn().mockResolvedValue({ id: 'req-1' }),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdOrg),
      },
      membership: {
        create: jest.fn().mockResolvedValue({
          id: 'membership-1',
          role: OrganizationRole.OWNER,
        }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      academicYear: {
        create: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      catalogSubject: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      subject: {
        upsert: jest.fn(),
      },
      orgSubject: {
        upsert: jest.fn(),
      },
      subjectLevel: {
        upsert: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof tx) => unknown) => fn(tx));

    const result = await service.create(
      { name: 'Audit Failure Org', type: OrganizationType.SCHOOL },
      'user-1',
      'idem-audit',
    );

    expect(result).toEqual(createdOrg);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.idempotencyKey.update).toHaveBeenCalledTimes(1);
    expect(bumpOrgVersion).toHaveBeenCalled();
  });

  it('rolls back the logical create when a required bootstrap step fails', async () => {
    const tx = {
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'req-1' }),
        update: jest.fn(),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Broken Bootstrap Org',
          address: null,
          city: null,
          country: null,
          type: OrganizationType.SCHOOL,
          status: OrganizationStatus.PENDING,
          ownerUserId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      },
      membership: {
        create: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      academicYear: {
        create: jest.fn().mockRejectedValue(new Error('bootstrap failed')),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      catalogSubject: {
        findMany: jest.fn(),
      },
      subject: {
        upsert: jest.fn(),
      },
      orgSubject: {
        upsert: jest.fn(),
      },
      subjectLevel: {
        upsert: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof tx) => unknown) => fn(tx));

    await expect(
      service.create(
        { name: 'Broken Bootstrap Org', type: OrganizationType.SCHOOL },
        'user-1',
        'idem-bootstrap',
      ),
    ).rejects.toThrow('bootstrap failed');

    expect(tx.idempotencyKey.update).not.toHaveBeenCalled();
    expect(bumpOrgVersion).not.toHaveBeenCalled();
  });

  it('returns success even when non-critical cache bump fails after commit', async () => {
    const createdOrg = {
      id: 'org-1',
      name: 'Cache Failure Org',
      address: null,
      city: null,
      country: null,
      type: OrganizationType.SCHOOL,
      status: OrganizationStatus.PENDING,
      ownerUserId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const tx = {
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'req-1' }),
        update: jest.fn().mockResolvedValue({ id: 'req-1' }),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdOrg),
      },
      membership: {
        create: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      academicYear: {
        create: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      catalogSubject: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      subject: {
        upsert: jest.fn(),
      },
      orgSubject: {
        upsert: jest.fn(),
      },
      subjectLevel: {
        upsert: jest.fn(),
      },
    };
    (bumpOrgVersion as jest.Mock).mockRejectedValueOnce(new Error('cache offline'));
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof tx) => unknown) => fn(tx));

    await expect(
      service.create(
        { name: 'Cache Failure Org', type: OrganizationType.SCHOOL },
        'user-1',
        'idem-cache',
      ),
    ).resolves.toEqual(createdOrg);
  });

  it('rejects owner-limit before entering the transaction for a non-replay request', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org-owned',
      ownerUserId: 'user-1',
    });

    const createPromise = service.create(
      { name: 'Second Org', type: OrganizationType.SCHOOL },
      'user-1',
      'different-key',
    );

    await expect(createPromise).rejects.toMatchObject({
      response: expect.objectContaining({ code: ORG_OWNER_LIMIT_REACHED }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
