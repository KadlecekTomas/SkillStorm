import { ConflictException } from '@nestjs/common';
import { LiveSessionMode, OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { AlgorithmLabQuickStartService } from './algorithm-lab-quick-start.service';

describe('AlgorithmLabQuickStartService', () => {
  const ctx = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    role: OrganizationRole.TEACHER,
  } as OrgContext;

  it('launches the published HYBRID Algorithm Lab version without teacher setup choreography', async () => {
    const prisma = {
      lessonExperienceVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' }),
      },
    };
    const classroom = {
      createLessonSession: jest.fn().mockResolvedValue({ id: 'session-1', status: 'DRAFT' }),
    };
    const service = new AlgorithmLabQuickStartService(prisma as never, classroom as never);

    await expect(service.launch(ctx)).resolves.toMatchObject({ id: 'session-1', status: 'DRAFT' });
    expect(classroom.createLessonSession).toHaveBeenCalledWith(
      {
        lessonExperienceVersionId: '33333333-3333-4333-8333-333333333333',
        mode: LiveSessionMode.HYBRID,
      },
      ctx,
    );
  });

  it('fails explicitly when there is no published HYBRID Algorithm Lab lesson', async () => {
    const prisma = {
      lessonExperienceVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const classroom = { createLessonSession: jest.fn() };
    const service = new AlgorithmLabQuickStartService(prisma as never, classroom as never);

    await expect(service.launch(ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(classroom.createLessonSession).not.toHaveBeenCalled();
  });
});
