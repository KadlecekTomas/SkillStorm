import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import type { PrismaService } from '@/prisma/prisma.service';
import { ClassroomStudentAccessService } from './classroom-student-access.service';

describe('ClassroomStudentAccessService RBAC boundary', () => {
  const liveSessionFindFirst = jest.fn();
  const membershipFindFirst = jest.fn();
  const studentFindUnique = jest.fn();
  const enrollmentFindFirst = jest.fn();
  const enrollmentFindMany = jest.fn();

  const prisma = {
    liveSession: { findFirst: liveSessionFindFirst },
    membership: { findFirst: membershipFindFirst },
    student: { findUnique: studentFindUnique },
    enrollment: { findFirst: enrollmentFindFirst, findMany: enrollmentFindMany },
  } as unknown as PrismaService;

  const service = new ClassroomStudentAccessService(prisma);
  const studentCtx: OrgContext = {
    organizationId: 'org-1',
    membershipId: 'membership-1',
    role: OrganizationRole.STUDENT,
    activeAcademicYearId: null,
    isAcademicYearExpired: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps classless preview and ad-hoc sessions accessible to an org student', async () => {
    liveSessionFindFirst.mockResolvedValue({ id: 'session-1', classSectionId: null });

    await expect(service.assertCanAccessSession('session-1', studentCtx)).resolves.toBeUndefined();
    expect(membershipFindFirst).not.toHaveBeenCalled();
    expect(studentFindUnique).not.toHaveBeenCalled();
    expect(enrollmentFindFirst).not.toHaveBeenCalled();
  });

  it('allows a class-bound session only with ACTIVE enrollment in that exact class', async () => {
    liveSessionFindFirst.mockResolvedValue({ id: 'session-1', classSectionId: 'class-8a' });
    membershipFindFirst.mockResolvedValue({ id: studentCtx.membershipId });
    studentFindUnique.mockResolvedValue({
      id: 'student-1',
      orgId: studentCtx.organizationId,
      deletedAt: null,
    });
    enrollmentFindFirst.mockResolvedValue({ id: 'enrollment-1' });

    await expect(service.assertCanAccessSession('session-1', studentCtx)).resolves.toBeUndefined();
    expect(enrollmentFindFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        classSectionId: 'class-8a',
        orgId: studentCtx.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  });

  it('hides a class-bound session from a same-org student enrolled elsewhere', async () => {
    liveSessionFindFirst.mockResolvedValue({ id: 'session-1', classSectionId: 'class-8a' });
    membershipFindFirst.mockResolvedValue({ id: studentCtx.membershipId });
    studentFindUnique.mockResolvedValue({
      id: 'student-1',
      orgId: studentCtx.organizationId,
      deletedAt: null,
    });
    enrollmentFindFirst.mockResolvedValue(null);

    await expect(service.assertCanAccessSession('session-1', studentCtx)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('discovers only a RUNNING or PAUSED Lesson Experience bound to an ACTIVE class enrollment', async () => {
    const activeYearCtx = { ...studentCtx, activeAcademicYearId: 'year-2026' };
    membershipFindFirst.mockResolvedValue({ id: activeYearCtx.membershipId });
    studentFindUnique.mockResolvedValue({
      id: 'student-1',
      orgId: activeYearCtx.organizationId,
      deletedAt: null,
    });
    enrollmentFindMany.mockResolvedValue([
      { classSectionId: 'class-8a' },
      { classSectionId: 'class-8a' },
    ]);
    liveSessionFindFirst.mockResolvedValue({
      id: 'session-live',
      status: 'RUNNING',
      mode: 'HYBRID',
      stateRevision: 2,
      classSectionId: 'class-8a',
      startedAt: new Date('2026-08-21T07:00:00.000Z'),
      pausedAt: null,
      currentLessonStageId: 'stage-algorithm',
      classSection: { id: 'class-8a', grade: 'GRADE_8', section: 'A' },
      currentLessonStage: {
        id: 'stage-algorithm',
        stageKey: 'ALGORITHM_LAB',
        title: 'Naplánuj a otestuj algoritmus',
        activityVersionId: 'activity-version-1',
      },
      lessonExperienceVersion: {
        id: 'lesson-version-1',
        title: 'Algoritmy · Robotická mise',
        lessonExperience: {
          id: 'lesson-1',
          slug: 'informatika-8-algoritmy',
          title: 'Algoritmy · Robotická mise',
        },
      },
    });

    await expect(service.findActiveSession(activeYearCtx)).resolves.toMatchObject({
      id: 'session-live',
      classSectionId: 'class-8a',
      lesson: {
        slug: 'informatika-8-algoritmy',
        versionId: 'lesson-version-1',
      },
      currentStage: { stageKey: 'ALGORITHM_LAB' },
    });
    expect(enrollmentFindMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        orgId: activeYearCtx.organizationId,
        status: 'ACTIVE',
        yearId: 'year-2026',
      },
      select: { classSectionId: true },
    });
    expect(liveSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: activeYearCtx.organizationId,
          classSectionId: { in: ['class-8a'] },
          status: { in: ['RUNNING', 'PAUSED'] },
        }),
      }),
    );
  });

  it('returns no active session when the student has no ACTIVE enrollment', async () => {
    membershipFindFirst.mockResolvedValue({ id: studentCtx.membershipId });
    studentFindUnique.mockResolvedValue({
      id: 'student-1',
      orgId: studentCtx.organizationId,
      deletedAt: null,
    });
    enrollmentFindMany.mockResolvedValue([]);

    await expect(service.findActiveSession(studentCtx)).resolves.toBeNull();
    expect(liveSessionFindFirst).not.toHaveBeenCalled();
  });

  it('does not disclose a foreign or missing classroom session', async () => {
    liveSessionFindFirst.mockResolvedValue(null);

    await expect(service.assertCanAccessSession('session-foreign', studentCtx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects non-student callers even when invoked outside controller RBAC', async () => {
    await expect(
      service.assertCanAccessSession('session-1', {
        ...studentCtx,
        role: OrganizationRole.TEACHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(liveSessionFindFirst).not.toHaveBeenCalled();
  });
});
