import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';
import { TeacherAssignmentClassAccessGuard } from './teacher-assignment-class-access.guard';

describe('TeacherAssignmentClassAccessGuard', () => {
  const prisma = {
    teacher: { findFirst: jest.fn() },
    classSection: { findFirst: jest.fn() },
  } as unknown as PrismaService;

  const guard = new TeacherAssignmentClassAccessGuard(prisma);

  const context = (user: Record<string, unknown>, classSectionId = 'class-1') =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          body: { classSectionId },
          params: { id: 'test-1' },
          query: {},
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows SUPERADMIN without class lookup', async () => {
    await expect(
      guard.canActivate(
        context({
          userId: 'admin-1',
          systemRole: SystemRole.SUPERADMIN,
        }),
      ),
    ).resolves.toBe(true);

    expect((prisma.classSection.findFirst as jest.Mock)).not.toHaveBeenCalled();
  });

  it('allows DIRECTOR only for a class in the active organization', async () => {
    (prisma.classSection.findFirst as jest.Mock).mockResolvedValue({ id: 'class-1' });

    await expect(
      guard.canActivate(
        context({
          userId: 'director-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.classSection.findFirst).toHaveBeenCalledWith({
      where: { id: 'class-1', orgId: 'org-1' },
      select: { id: true },
    });
  });

  it('rejects DIRECTOR when the class is outside the active organization', async () => {
    (prisma.classSection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        context({
          userId: 'director-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows TEACHER only when teacherClassScope resolves the class', async () => {
    (prisma.teacher.findFirst as jest.Mock).mockResolvedValue({ id: 'teacher-1' });
    (prisma.classSection.findFirst as jest.Mock).mockResolvedValue({ id: 'class-1' });

    await expect(
      guard.canActivate(
        context({
          userId: 'teacher-user-1',
          membershipId: 'teacher-membership-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.TEACHER,
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.teacher.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          membershipId: 'teacher-membership-1',
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.classSection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'class-1',
          orgId: 'org-1',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('rejects TEACHER for another same-org class', async () => {
    (prisma.teacher.findFirst as jest.Mock).mockResolvedValue({ id: 'teacher-1' });
    (prisma.classSection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        context({
          userId: 'teacher-user-1',
          membershipId: 'teacher-membership-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.TEACHER,
        }, 'class-not-taught'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
