import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import type { PrismaService } from '@/prisma/prisma.service';
import { ClassroomStudentAccessService } from './classroom-student-access.service';

describe('ClassroomStudentAccessService', () => {
  const liveSessionFindFirst = jest.fn();
  const membershipFindFirst = jest.fn();
  const studentFindUnique = jest.fn();
  const enrollmentFindFirst = jest.fn();

  const prisma = {
    liveSession: { findFirst: liveSessionFindFirst },
    membership: { findFirst: membershipFindFirst },
    student: { findUnique: studentFindUnique },
    enrollment: { findFirst: enrollmentFindFirst },
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
    studentFindUnique.mockResolvedValue({ id: 'student-1', orgId: studentCtx.organizationId, deletedAt: null });
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
    studentFindUnique.mockResolvedValue({ id: 'student-1', orgId: studentCtx.organizationId, deletedAt: null });
    enrollmentFindFirst.mockResolvedValue(null);

    await expect(service.assertCanAccessSession('session-1', studentCtx)).rejects.toMatchObject({
      status: 404,
    });
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
