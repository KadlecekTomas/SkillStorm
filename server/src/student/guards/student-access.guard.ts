import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnrollmentStatus, OrganizationRole, SystemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditEntityType } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';

/**
 * GDPR student detail: only CLASS_TEACHER (homeroom), SUBJECT_TEACHER (future),
 * SCHOOL_DIRECTOR (DIRECTOR/OWNER), SUPERADMIN. Students cannot view detail (including self).
 * On deny: 403 + audit STUDENT_DETAIL_ACCESS_DENIED.
 */
@Injectable()
export class StudentAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const studentId = request.params?.id;
    if (!studentId || typeof studentId !== 'string') {
      throw new ForbiddenException('Missing student id');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        orgId: true,
        membershipId: true,
        deletedAt: true,
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: {
            classSectionId: true,
            classSection: {
              select: {
                teacherId: true,
                teacher: {
                  select: {
                    membershipId: true,
                    membership: { select: { userId: true } },
                  },
                },
              },
            },
            academicYear: { select: { isCurrent: true } },
          },
        },
      },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException('Student nenalezen.');
    }

    const orgMatch =
      user.organizationId === student.orgId ||
      user.systemRole === SystemRole.SUPERADMIN;
    if (!orgMatch) {
      await this.audit.log({
        action: 'STUDENT_DETAIL_ACCESS_DENIED',
        entityType: AuditEntityType.STUDENT,
        entityId: studentId,
        userId: user.userId,
        organizationId: user.organizationId ?? null,
        metadata: { reason: 'org_mismatch', studentOrgId: student.orgId },
      });
      throw new ForbiddenException(
        'Nemáš oprávnění zobrazit detail tohoto žáka.',
      );
    }

    if (user.organizationRole === OrganizationRole.STUDENT) {
      await this.audit.log({
        action: 'STUDENT_DETAIL_ACCESS_DENIED',
        entityType: AuditEntityType.STUDENT,
        entityId: studentId,
        userId: user.userId,
        organizationId: user.organizationId ?? null,
        metadata: { reason: 'student_role_not_allowed' },
      });
      throw new ForbiddenException('Žáci nemají přístup k detailu žáka.');
    }

    if (user.systemRole === SystemRole.SUPERADMIN) {
      return true;
    }

    if (
      user.organizationRole === OrganizationRole.DIRECTOR ||
      user.organizationRole === OrganizationRole.OWNER
    ) {
      return true;
    }

    if (user.organizationRole === OrganizationRole.TEACHER) {
      const teachesStudent = student.enrollments.some(
        (e) =>
          e.academicYear?.isCurrent === true &&
          e.classSection?.teacher?.membership?.userId &&
          String(e.classSection.teacher.membership.userId) ===
            String(user.userId),
      );
      if (teachesStudent) return true;

      await this.audit.log({
        action: 'STUDENT_DETAIL_ACCESS_DENIED',
        entityType: AuditEntityType.STUDENT,
        entityId: studentId,
        userId: user.userId,
        organizationId: user.organizationId ?? null,
        metadata: { reason: 'teacher_not_homeroom_of_student' },
      });
      throw new ForbiddenException(
        'Nemáš oprávnění zobrazit detail tohoto žáka.',
      );
    }

    await this.audit.log({
      action: 'STUDENT_DETAIL_ACCESS_DENIED',
      entityType: AuditEntityType.STUDENT,
      entityId: studentId,
      userId: user.userId,
      organizationId: user.organizationId ?? null,
      metadata: { reason: 'role_not_allowed' },
    });
    throw new ForbiddenException(
      'Nemáš oprávnění zobrazit detail tohoto žáka.',
    );
  }
}
