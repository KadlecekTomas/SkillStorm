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
    const studentAccess = { assertCanAccessSession: jest.fn().mockResolvedValue(undefined) };
    const service = new AlgorithmLabJoinCodeService(prisma as never, studentAccess as never);

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
    expect(studentAccess.assertCanAccessSession).toHaveBeenCalledWith(
      'abcdef12-3456-4789-8123-123456789abc',
      ctx,
    );
  });

  it('filters inaccessible same-code sessions before ambiguity is evaluated', async () => {
    const visible = 'abcdef12-3456-4789-8123-123456789abc';
    const hidden = 'abcdef12-9999-4789-8123-123456789abc';
    const prisma = {
      liveSession: {
        findMany: jest.fn().mockResolvedValue([{ id: visible }, { id: hidden }]),
      },
    };
    const studentAccess = {
      assertCanAccessSession: jest.fn(async (sessionId: string) => {
        if (sessionId === hidden) {
          throw new NotFoundException({ code: 'CLASSROOM_SESSION_NOT_FOUND' });
        }
      }),
    };
    const service = new AlgorithmLabJoinCodeService(prisma as never, studentAccess as never);

    await expect(service.resolve('ABCD-EF12', ctx)).resolves.toEqual({ sessionId: visible });
    expect(studentAccess.assertCanAccessSession).toHaveBeenCalledTimes(2);
  });

  it('returns not found when the code exists only for an inaccessible class', async () => {
    const hidden = 'abcdef12-9999-4789-8123-123456789abc';
    const prisma = {
      liveSession: { findMany: jest.fn().mockResolvedValue([{ id: hidden }]) },
    };
    const studentAccess = {
      assertCanAccessSession: jest
        .fn()
        .mockRejectedValue(new NotFoundException({ code: 'CLASSROOM_SESSION_NOT_FOUND' })),
    };
    const service = new AlgorithmLabJoinCodeService(prisma as never, studentAccess as never);

    await expect(service.resolve('ABCD-EF12', ctx)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects malformed or unknown codes without leaking sessions', async () => {
    const prisma = {
      liveSession: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const studentAccess = { assertCanAccessSession: jest.fn() };
    const service = new AlgorithmLabJoinCodeService(prisma as never, studentAccess as never);

    await expect(service.resolve('123', ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.liveSession.findMany).not.toHaveBeenCalled();
    expect(studentAccess.assertCanAccessSession).not.toHaveBeenCalled();
  });
});
