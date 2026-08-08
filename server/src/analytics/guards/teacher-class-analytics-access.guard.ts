import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestWithUser } from '@/types/request-with-user';
import { teacherClassScope } from '@/shared/access.utils';

/**
 * Relationship-aware guard for class analytics.
 *
 * DIRECTOR/OWNER may inspect any class in the active organization.
 * TEACHER may inspect only a homeroom class or a class covered by an active
 * TeacherClassSection assignment. This keeps analytics aligned with the class
 * list, risk overview and student-detail access rules.
 */
@Injectable()
export class TeacherClassAnalyticsAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const classId = request.params?.classId;

    if (!classId || typeof classId !== 'string') {
      throw new ForbiddenException('Missing class context.');
    }

    if (user.systemRole === SystemRole.SUPERADMIN) return true;

    const orgId = user.organizationId ?? null;
    if (!orgId) {
      throw new ForbiddenException('Missing organization context.');
    }

    if (
      user.organizationRole === OrganizationRole.DIRECTOR ||
      user.organizationRole === OrganizationRole.OWNER
    ) {
      const sameOrgClass = await this.prisma.classSection.findFirst({
        where: { id: classId, orgId },
        select: { id: true },
      });
      if (!sameOrgClass) {
        throw new ForbiddenException('Třída nepatří do aktivní organizace.');
      }
      return true;
    }

    if (user.organizationRole !== OrganizationRole.TEACHER) {
      throw new ForbiddenException('Přístup k analytice třídy není povolen.');
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
        id: classId,
        orgId,
        ...teacherClassScope(teacher.id),
      },
      select: { id: true },
    });

    if (!allowedClass) {
      throw new ForbiddenException('Učitel nemá přístup k této třídě.');
    }

    return true;
  }
}
