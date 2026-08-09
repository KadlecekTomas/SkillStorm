import { LiveSessionMode, OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { AlgorithmLabAutoPairService } from './algorithm-lab-auto-pair.service';

describe('AlgorithmLabAutoPairService', () => {
  const ctx = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    role: OrganizationRole.STUDENT,
  } as OrgContext;

  function harness(countInFirstGroup: number) {
    const tx = {
      $executeRaw: jest.fn(),
      liveSessionParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', groupId: null }),
        groupBy: jest.fn().mockResolvedValue(
          countInFirstGroup > 0
            ? [{ groupId: 'g1', _count: { _all: countInFirstGroup } }]
            : [],
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'p1', groupId: data.groupId }),
        ),
      },
      liveSessionGroup: {
        findMany: jest.fn().mockResolvedValue([{ id: 'g1', orderIndex: 0 }]),
        create: jest.fn().mockResolvedValue({ id: 'g2', orderIndex: 1 }),
      },
    };
    const prisma = {
      liveSession: { findUnique: jest.fn().mockResolvedValue({ mode: LiveSessionMode.HYBRID }) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const classroom = {
      joinAsStudent: jest.fn().mockResolvedValue({ id: 'p1', groupId: null }),
    };
    return { tx, prisma, classroom };
  }

  it('puts the next student into the first pair with free capacity', async () => {
    const { tx, prisma, classroom } = harness(1);
    const service = new AlgorithmLabAutoPairService(prisma as never, classroom as never);

    await expect(service.join('session-1', {}, ctx)).resolves.toMatchObject({ groupId: 'g1' });
    expect(tx.liveSessionGroup.create).not.toHaveBeenCalled();
  });

  it('creates the next pair when all existing pairs already have two students', async () => {
    const { tx, prisma, classroom } = harness(2);
    const service = new AlgorithmLabAutoPairService(prisma as never, classroom as never);

    await expect(service.join('session-1', {}, ctx)).resolves.toMatchObject({ groupId: 'g2' });
    expect(tx.liveSessionGroup.create).toHaveBeenCalledWith({
      data: { sessionId: 'session-1', label: 'Dvojice 2', orderIndex: 1 },
      select: { id: true, orderIndex: true },
    });
  });
});
