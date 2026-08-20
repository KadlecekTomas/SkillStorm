import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EnrollmentStatus,
  LiveSessionSourceKind,
  OrganizationRole,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ClassroomStudentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessSession(sessionId: string, ctx: OrgContext): Promise<void> {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Tento vstup je určen žákovi.',
      });
    }

    const session = await this.prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        organizationId: ctx.organizationId,
        sourceKind: LiveSessionSourceKind.LESSON_EXPERIENCE,
      },
      select: { id: true, classSectionId: true },
    });

    if (!session) {
      throw this.notAvailable();
    }

    // Classless sessions are intentionally supported for previews and ad-hoc lessons.
    // As soon as a teacher binds a session to a class, enrollment becomes the boundary.
    if (!session.classSectionId) return;

    const membership = await this.prisma.membership.findFirst({
      where: {
        id: ctx.membershipId,
        organizationId: ctx.organizationId,
        role: OrganizationRole.STUDENT,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      throw this.notAvailable();
    }

    const student = await this.prisma.student.findUnique({
      where: { membershipId: membership.id },
      select: { id: true, orgId: true, deletedAt: true },
    });
    if (!student || student.deletedAt || student.orgId !== ctx.organizationId) {
      throw this.notAvailable();
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        classSectionId: session.classSectionId,
        orgId: ctx.organizationId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw this.notAvailable();
    }
  }

  private notAvailable(): NotFoundException {
    return new NotFoundException({
      code: 'CLASSROOM_SESSION_NOT_FOUND',
      message: 'Interaktivní hodina nebyla nalezena.',
    });
  }
}
