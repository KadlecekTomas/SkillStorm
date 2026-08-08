import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  OrganizationRole,
  SystemRole,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestWithUser } from '@/types/request-with-user';
import { teacherClassScope } from '@/shared/access.utils';

/**
 * Relationship-aware access for /analytics/student-timeline.
 * studentId on this endpoint is Membership.id (matching Submission.studentId).
 */
@Injectable()
export class StudentAnalyticsAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const orgId = user.organizationId ?? null;
    const requestedStudentMembershipId =
      typeof request.query?.studentId === 'string' && request.query.studentId.length > 0
        ? request.query.studentId
        : null;
    const yearId =
      typeof request.query?.yearId === 'string' && request.query.yearId.length > 0
        ? request.query.yearId
        : null;

    if (user.systemRole === SystemRole.SUPERADMIN) return true;
    if (!orgId) throw new ForbiddenException('Missing organization context.');

    if (user.organizationRole === OrganizationRole.STUDENT) {
      if (
        requestedStudentMembershipId &&
        requestedStudentMembershipId !== user.membershipId
      ) {
        throw new ForbiddenException('Žák může zobrazit pouze vlastní výsledky.');
      }
      return true;
    }

    if (
      user.organizationRole === OrganizationRole.DIRECTOR ||
      user.organizationRole === OrganizationRole.OWNER
    ) {
      if (!requestedStudentMembershipId) return true;
      const sameOrgStudent = await this.prisma.student.findFirst({
        where: {
          orgId,
          membershipId: requestedStudentMembershipId,
          deletedAt: null,
          membership: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!sameOrgStudent) {
        throw new ForbiddenException('Žák nepatří do aktivní organizace.');
      }
      return true;
    }

    if (user.organizationRole !== OrganizationRole.TEACHER) {
      throw new ForbiddenException('Přístup k výsledkům žáka není povolen.');
    }

    if (!requestedStudentMembershipId || !yearId) {
      throw new ForbiddenException('Chybí kontext žáka nebo školního roku.');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(user.membershipId
          ? { membershipId: user.membershipId }
          : {
              membership: {
                userId: user.userId,
                organizationId: orgId,
                deletedAt: null,
              },
            }),
      },
      select: { id: true },
    });
    if (!teacher) {
      throw new ForbiddenException('Profil učitele nebyl nalezen.');
    }

    const allowedClass = await this.prisma.classSection.findFirst({
      where: {
        orgId,
        yearId,
        ...teacherClassScope(teacher.id, yearId),
        enrollments: {
          some: {
            yearId,
            status: { not: EnrollmentStatus.LEFT },
            student: {
              orgId,
              membershipId: requestedStudentMembershipId,
              deletedAt: null,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!allowedClass) {
      throw new ForbiddenException('Učitel nemá přístup k tomuto žákovi.');
    }

    return true;
  }
}
