import { ForbiddenException } from '@nestjs/common';
import {
  ActivityDeliveryMode,
  LessonExperienceVersionStatus,
  LiveSessionMode,
  OrganizationRole,
  SchoolGrade,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import type { PrismaService } from '@/prisma/prisma.service';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';

describe('ClassroomOrchestrationService teacher class boundary', () => {
  const lessonExperienceVersionFindUnique = jest.fn();
  const classSectionFindFirst = jest.fn();
  const teacherFindFirst = jest.fn();
  const teacherClassSectionFindFirst = jest.fn();
  const liveSessionCreate = jest.fn();

  const prisma = {
    lessonExperienceVersion: { findUnique: lessonExperienceVersionFindUnique },
    classSection: { findFirst: classSectionFindFirst },
    teacher: { findFirst: teacherFindFirst },
    teacherClassSection: { findFirst: teacherClassSectionFindFirst },
    liveSession: { create: liveSessionCreate },
  } as unknown as PrismaService;

  const service = new ClassroomOrchestrationService(prisma);
  const ctx: OrgContext = {
    organizationId: 'org-1',
    membershipId: 'membership-teacher',
    role: OrganizationRole.TEACHER,
    activeAcademicYearId: 'year-2026',
    isAcademicYearExpired: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lessonExperienceVersionFindUnique.mockResolvedValue({
      id: 'lesson-version-1',
      status: LessonExperienceVersionStatus.PUBLISHED,
      supportedModes: [ActivityDeliveryMode.HYBRID],
      lessonExperience: {
        id: 'lesson-1',
        scope: 'GLOBAL',
        organizationId: null,
        deletedAt: null,
      },
      stages: [{ id: 'stage-1' }],
    });
    classSectionFindFirst.mockResolvedValue({
      id: 'class-8a',
      grade: SchoolGrade.GRADE_8,
      yearId: 'year-2026',
      teacherId: null,
    });
    teacherFindFirst.mockResolvedValue({ id: 'teacher-1' });
    teacherClassSectionFindFirst.mockResolvedValue(null);
  });

  it('rejects a same-organization class when the teacher is neither homeroom nor assigned', async () => {
    await expect(
      service.createLessonSession(
        {
          lessonExperienceVersionId: 'lesson-version-1',
          classSectionId: 'class-8a',
          mode: LiveSessionMode.HYBRID,
        },
        ctx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(teacherFindFirst).toHaveBeenCalledWith({
      where: {
        membershipId: ctx.membershipId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(teacherClassSectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacherId: 'teacher-1',
          classSectionId: 'class-8a',
          yearId: 'year-2026',
          deletedAt: null,
        }),
      }),
    );
    expect(liveSessionCreate).not.toHaveBeenCalled();
  });
});
