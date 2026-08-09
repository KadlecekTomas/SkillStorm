import { NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import {
  AlgorithmLabJoinCodeService,
  classroomCodeForSession,
} from './algorithm-lab-join-code.service';

describe('AlgorithmLabJoinCodeService', () => {
  const ctx = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    role: OrganizationRole.STUDENT,
  } as OrgContext;

  it('formats an eight-character classroom code from the session id', () => {
    expect(
      classroomCodeForSession('abcdef12-3456-4789-8123-123456789abc'),
    ).toBe('ABCD-EF12');
  });

  it('resolves only active Algorithm Lab sessions inside the current organization', async () => {
    const prisma = {
      liveSession: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'abcdef12-3456-4789-8123-123456789abc' },
          { id: 'deadbeef-3456-4789-8123-123456789abc' },
        ]),
      },
    };
    const service = new AlgorithmLabJoinCodeService(prisma as never);

    await expect(service.resolve('abcd-ef12', ctx)).resolves.toEqual({
      sessionId: 'abcdef12-3456-4789-8123-123456789abc',
    });
    expect(prisma.liveSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ctx.organizationId,
          mode: 'HYBRID',
          lessonExperienceVersion: {
            is: { stages: { some: { stageKey: 'ALGORITHM_LAB' } } },
          },
        }),
        take: 200,
      }),
    );
  });

  it('rejects malformed or unknown codes without leaking sessions', async () => {
    const prisma = {
      liveSession: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AlgorithmLabJoinCodeService(prisma as never);

    await expect(service.resolve('123', ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.liveSession.findMany).not.toHaveBeenCalled();
  });
});
