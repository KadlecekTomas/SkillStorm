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
 * Relationship-aware protection for POST /tests/:id/assign.
 *
 * The class picker is already scoped in the UI, but API authorization must not
 * depend on UI filtering. A teacher can assign only to a homeroom class or an
 * actively taught TeacherClassSection in the active organization. Leadership
 * keeps organization-wide assignment rights.
 */
@Injectable()
export class TeacherAssignmentClassAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const classSectionId =
      typeof request.body?.classSectionId === 'string'
        ? request.body.classSectionId
        : null;

    if (user.systemRole === SystemRole.SUPERADMIN) return true;
    if (!user.organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    if (!classSectionId) {
      // DTO validation will provide the precise 400 for malformed payloads.
      return true;
    }

    if (
      user.organizationRole === OrganizationRole.DIRECTOR ||
      user.organizationRole === OrganizationRole.OWNER
    ) {
      const sameOrg = await this.prisma.classSection.findFirst({
        where: { id: classSectionId, orgId: user.organizationId },
        select: { id: true },
      });
      if (!sameOrg) {
        throw new ForbiddenException('Třída nepatří do aktivní organizace.');
      }
      return true;
    }

    if (user.organizationRole !== OrganizationRole.TEACHER) {
      throw new ForbiddenException('Přiřazení testu není pro tuto roli povoleno.');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        ...(user.membershipId
          ? { membershipId: user.membershipId }
          : {
              membership: {
                userId: user.userId,
                organizationId: user.organizationId,
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
        id: classSectionId,
        orgId: user.organizationId,
        ...teacherClassScope(teacher.id),
      },
      select: { id: true },
    });
    if (!allowedClass) {
      throw new ForbiddenException('Učitel nemůže přiřadit test této třídě.');
    }

    return true;
  }
}
