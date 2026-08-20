import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EnrollmentStatus,
  LiveSessionSourceKind,
  LiveSessionStatus,
  OrganizationRole,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ClassroomStudentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessSession(sessionId: string, ctx: OrgContext): Promise<void> {
    this.assertStudent(ctx);

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

    const student = await this.requireStudentRecord(ctx);
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

  async findActiveSession(ctx: OrgContext) {
    this.assertStudent(ctx);
    const student = await this.requireStudentRecord(ctx, false);
    if (!student) return null;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        orgId: ctx.organizationId,
        status: EnrollmentStatus.ACTIVE,
        ...(ctx.activeAcademicYearId ? { yearId: ctx.activeAcademicYearId } : {}),
      },
      select: { classSectionId: true },
    });
    const classSectionIds = Array.from(new Set(enrollments.map((item) => item.classSectionId)));
    if (classSectionIds.length === 0) return null;

    const session = await this.prisma.liveSession.findFirst({
      where: {
        organizationId: ctx.organizationId,
        sourceKind: LiveSessionSourceKind.LESSON_EXPERIENCE,
        classSectionId: { in: classSectionIds },
        status: { in: [LiveSessionStatus.RUNNING, LiveSessionStatus.PAUSED] },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        mode: true,
        stateRevision: true,
        classSectionId: true,
        startedAt: true,
        pausedAt: true,
        currentLessonStageId: true,
        classSection: {
          select: { id: true, grade: true, section: true },
        },
        currentLessonStage: {
          select: {
            id: true,
            stageKey: true,
            title: true,
            activityVersionId: true,
          },
        },
        lessonExperienceVersion: {
          select: {
            id: true,
            title: true,
            lessonExperience: {
              select: { id: true, slug: true, title: true },
            },
          },
        },
      },
    });

    if (!session?.lessonExperienceVersion) return null;

    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      stateRevision: session.stateRevision,
      classSectionId: session.classSectionId,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      currentLessonStageId: session.currentLessonStageId,
      classSection: session.classSection,
      currentStage: session.currentLessonStage,
      lesson: {
        id: session.lessonExperienceVersion.lessonExperience.id,
        slug: session.lessonExperienceVersion.lessonExperience.slug,
        title: session.lessonExperienceVersion.title,
        versionId: session.lessonExperienceVersion.id,
      },
    };
  }

  private assertStudent(ctx: OrgContext): void {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Tento vstup je určen žákovi.',
      });
    }
  }

  private async requireStudentRecord(
    ctx: OrgContext,
    throwIfMissing = true,
  ): Promise<{ id: string } | null> {
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
      if (throwIfMissing) throw this.notAvailable();
      return null;
    }

    const student = await this.prisma.student.findUnique({
      where: { membershipId: membership.id },
      select: { id: true, orgId: true, deletedAt: true },
    });
    if (!student || student.deletedAt || student.orgId !== ctx.organizationId) {
      if (throwIfMissing) throw this.notAvailable();
      return null;
    }
    return { id: student.id };
  }

  private notAvailable(): NotFoundException {
    return new NotFoundException({
      code: 'CLASSROOM_SESSION_NOT_FOUND',
      message: 'Interaktivní hodina nebyla nalezena.',
    });
  }
}
