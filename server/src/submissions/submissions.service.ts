// src/submissions/submissions.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditEntityType, SubmissionStatus, XpEventType } from '@prisma/client';
import { computeScore } from './submission-scoring';
import { PrismaService } from '@/prisma/prisma.service';
import {
  assertSameOrganizationIds,
  teacherClassScope,
} from '@/shared/access.utils';
import {
  deriveOrgReadiness,
  OrgReadinessState,
} from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import { OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { GamificationService } from '@/gamification/gamification.service';
import { AuditService } from '@/audit/audit.service';
import { AnalyticsSnapshotService } from '@/analytics/analytics-snapshot.service';
import type { FocusEventType } from './dto/focus-events.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { assertTenantWhere, withOrg } from '@/common/prisma/tenant-scope';
import {
  bumpOrgVersion,
  invalidateResourcesFailSafe,
} from '@/shared/cache/org-cache.utils';

type JwtUser = JwtPayload;

type RespInDto = { questionId: string; givenText: any };

/** DB trigger raises this when response is written for a submitted submission. Map to 409. */
export const SUBMISSION_LOCKED_ERROR_CODE = 'SUBMISSION_LOCKED';

function isSubmissionLockedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('SUBMISSION_LOCKED');
}

/** Org-scoped submission lookup: use in every findUnique/findFirst for submissions to enforce 404 cross-org (no leak). */
function scopedSubmissionWhere(
  orgId: string,
  submissionId: string,
): { id: string; organizationId: string } {
  return { id: submissionId, organizationId: orgId };
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly audit: AuditService,
    private readonly analyticsSnapshot: AnalyticsSnapshotService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---- helpers -------------------------------------------------------------

  private async getActiveMembership(user: JwtUser) {
    if (user.membershipId) {
      const m = await this.prisma.membership.findFirst({
        where: { id: user.membershipId, deletedAt: null },
        select: {
          id: true,
          organizationId: true,
          role: true,
        },
      });
      if (m) return m;
    }
    // fallback: podle (user.id, orgId) – některé guardy nemusí membershipId přidat
    if (user.organizationId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
        select: { id: true, organizationId: true, role: true },
      });
      if (m) return m;
    }
    // poslední fallback: jakýkoli membership (pokud má jen jeden, je to OK)
    const m = await this.prisma.membership.findFirst({
      where: { userId: user.userId, deletedAt: null },
      select: { id: true, organizationId: true, role: true },
    });
    if (!m)
      throw new ForbiddenException('Nemáš aktivní členství v organizaci.');
    return m;
  }

  private async getTeacherAssignmentScope(membershipId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { membershipId, deletedAt: null },
      select: { id: true },
    });
    return {
      OR: [
        { createdById: membershipId },
        // homeroom NEBO aktivní úvazek — viz teacherClassScope (audit homeroom-only)
        ...(teacher ? [{ classSection: teacherClassScope(teacher.id) }] : []),
      ],
    };
  }

  private async getMembershipFromCtx(ctx: OrgContext) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: ctx.membershipId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true, organizationId: true, role: true },
    });
    if (!membership) {
      throw new ForbiddenException('Nemáš aktivní členství v organizaci.');
    }
    return membership;
  }

  private sanitizeSubmission(
    submission: {
      id: string;
      assignmentId: string | null;
      testId: string;
      status: SubmissionStatus;
      score: number | null;
      earnedPoints?: number | null;
      maxPoints?: number | null;
      submittedAt: Date | null;
      attemptNo: number;
      isAnonymous?: boolean | null;
      responses?: Array<{
        id: string;
        questionId: string;
        givenText: string;
        isCorrect: boolean | null;
      }>;
      student?: { user?: { name: string | null } | null } | null;
    },
    role: string | null,
    options?: { includeResponses?: boolean },
  ) {
    const includeResponses = options?.includeResponses ?? true;
    const earnedPoints = submission.earnedPoints ?? null;
    const maxPoints = submission.maxPoints ?? null;
    const percentage =
      earnedPoints != null && maxPoints != null && maxPoints > 0
        ? Math.round((earnedPoints / maxPoints) * 10000) / 100
        : null;
    return {
      id: submission.id,
      assignmentId: submission.assignmentId,
      testId: submission.testId,
      status: submission.status,
      score: submission.score,
      earnedPoints,
      maxPoints,
      percentage,
      submittedAt: submission.submittedAt,
      attemptNo: submission.attemptNo,
      isAnonymous: submission.isAnonymous ?? false,
      ...(includeResponses
        ? {
            responses:
              submission.responses?.map((r) => ({
                questionId: r.questionId,
                givenText: r.givenText,
                isCorrect: r.isCorrect,
              })) ?? [],
          }
        : {}),
      student:
        role === 'STUDENT'
          ? null
          : { name: submission.student?.user?.name ?? null },
    };
  }

  private normalizeFitb(s?: string | null) {
    return (
      (s ?? '')
        .trim()
        .normalize('NFD')
        // eslint-disable-next-line no-useless-escape
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
    );
  }

  private normalizeText(value?: string | null) {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAnswerList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .map((v) => String(v).trim())
              .filter((v) => v.length > 0);
          }
        } catch {
          return [];
        }
      }
    }
    return [];
  }

  private serializeGivenText(value: unknown): string {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  }

  private async invalidateSubmissionDerivedCaches(
    organizationId: string,
    mutation: string,
  ): Promise<void> {
    await bumpOrgVersion(this.cache, organizationId);
    await invalidateResourcesFailSafe(this.cache, {
      scopeId: organizationId,
      resources: ['dashboard'],
      mutation,
      logger: this.logger,
    });
  }

  // ---- API methods ---------------------------------------------------------

  async create(dto: { assignmentId: string }, user: JwtUser, ctx?: OrgContext) {
    // 1) assignment + test + (při cílení na STUDENTS i seznam studentů)
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: dto.assignmentId },
      include: {
        test: { select: { id: true, organizationId: true } },
        students: { select: { studentId: true } }, // AssignmentStudent[]
        academicYear: { select: { id: true, startsAt: true, endsAt: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment nenalezen');
    if (ctx && assignment.organizationId !== ctx.organizationId) {
      throw new NotFoundException('Assignment nenalezen');
    }

    // 1b) Org readiness >= R2 (invariant)
    const readiness = await deriveOrgReadiness(
      this.prisma,
      assignment.organizationId,
    );
    if (!readiness.canExecute) {
      throw createOrgReadinessError({
        operationType: OrgOperationType.EXECUTION,
        state: readiness.state,
        missing: readiness.missing,
        requiredMinState: OrgReadinessState.R2_STRUCTURE_READY,
        messageOverride: 'Organization is not ready for submissions.',
      });
    }

    // 2) membership studenta (nebo učitele – ale submission dává smysl pro STUDENTa)
    const membership = ctx
      ? await this.getMembershipFromCtx(ctx)
      : await this.getActiveMembership(user);
    if (String(membership.role) !== 'STUDENT') {
      throw new ForbiddenException('Only students can create submissions.');
    }

    // 3) multitenancy
    assertSameOrganizationIds(
      assignment.organizationId,
      membership.organizationId,
      'assignment',
    );

    // 4) přístup studenta podle targetType
    const isStudent = String(membership.role) === 'STUDENT';

    if (isStudent) {
      let allowed = false;

      if (assignment.targetType === 'STUDENTS') {
        allowed = assignment.students.some(
          (s) => s.studentId === membership.id,
        );
      } else {
        // targetType === 'CLASS' – ověř zápis v téhle třídě (Enrollment.classSectionId)
        if (assignment.classSectionId) {
          const enrolled = await this.prisma.enrollment.findFirst({
            where: {
              student: { membershipId: membership.id },
              classSectionId: assignment.classSectionId,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          allowed = !!enrolled;
        }
      }

      if (!allowed) {
        throw new ForbiddenException(
          'Assignment není určen pro tohoto studenta',
        );
      }
    }

    // 5) okno otevření + academic year boundary
    const now = new Date();
    if (assignment.academicYear) {
      if (
        now < assignment.academicYear.startsAt ||
        now > assignment.academicYear.endsAt
      ) {
        throw new BadRequestException({
          code: 'YEAR_WINDOW_CLOSED',
          message: 'Odevzdání není možné mimo rozsah školního roku.',
        });
      }
    }
    if (now < assignment.openAt)
      throw new BadRequestException('Assignment ještě není otevřen');
    if (now > assignment.closeAt)
      throw new BadRequestException('Assignment je uzavřen');

    // 6) count + create must be serialized for the same student to shrink the race window.
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT membership_id FROM memberships WHERE membership_id = ${membership.id} FOR UPDATE`,
        );

        const attempts = await tx.submission.count({
          where: {
            organizationId: assignment.organizationId,
            assignmentId: assignment.id,
            studentId: membership.id,
          },
        });
        if (attempts >= assignment.maxAttempts) {
          throw new BadRequestException('Vyčerpán maximální počet pokusů');
        }

        return tx.submission.create({
          data: {
            organizationId: assignment.organizationId,
            assignmentId: assignment.id,
            testId: assignment.testId,
            studentId: membership.id,
            attemptNo: attempts + 1,
            status: SubmissionStatus.PENDING,
          },
        });
      });
      await this.invalidateSubmissionDerivedCaches(
        assignment.organizationId,
        'submissions.create',
      );
      return created;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.submission.findFirst({
          where: {
            organizationId: assignment.organizationId,
            assignmentId: assignment.id,
            studentId: membership.id,
          },
          orderBy: { attemptNo: 'desc' },
        });
        if (existing) return existing;
        throw new ConflictException(
          'Submission for this assignment and attempt already exists.',
        );
      }
      throw e;
    }
  }

  async updateResponses(
    id: string,
    dto: { responses?: RespInDto[] },
    user: JwtUser,
    ctx?: OrgContext,
  ) {
    const membership = ctx
      ? await this.getMembershipFromCtx(ctx)
      : await this.getActiveMembership(user);
    if (String(membership.role) !== 'STUDENT') {
      throw new ForbiddenException('Only students can update submissions.');
    }
    const list = dto.responses ?? [];
    if (list.length === 0) return { success: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT submission_id FROM submissions WHERE submission_id = ${id} FOR UPDATE`,
      );

      const submission = await tx.submission.findUnique({
        where: scopedSubmissionWhere(membership.organizationId, id),
        include: {
          assignment: { select: { organizationId: true } },
          student: { select: { id: true, organizationId: true } },
          responses: { select: { id: true, questionId: true } },
        },
      });
      if (!submission) throw new NotFoundException('Submission nenalezena');
      if (!submission.assignment) {
        throw new NotFoundException('Submission nemá přiřazený assignment.');
      }
      if (submission.studentId !== membership.id) {
        throw new ForbiddenException('Access denied');
      }
      if (submission.submittedAt) {
        throw new ConflictException({
          message: 'Submission je již uzavřena',
          errorCode: SUBMISSION_LOCKED_ERROR_CODE,
        });
      }

      const test = await tx.test.findUnique({
        where: { id: submission.testId },
        select: { questions: { select: { id: true } } },
      });
      const validQuestionIds = new Set(
        (test?.questions ?? []).map((q) => q.id),
      );

      for (const r of list) {
        if (!validQuestionIds.has(r.questionId)) {
          throw new BadRequestException('Nevalidní questionId');
        }
        const existing = submission.responses.find(
          (x) => x.questionId === r.questionId,
        );
        try {
          if (existing) {
            await tx.response.update({
              where: { id: existing.id },
              data: { givenText: this.serializeGivenText(r.givenText) },
            });
          } else {
            await tx.response.create({
              data: {
                submissionId: submission.id,
                questionId: r.questionId,
                givenText: this.serializeGivenText(r.givenText),
              },
            });
          }
        } catch (e: unknown) {
          if (isSubmissionLockedError(e)) {
            throw new ConflictException({
              message: 'Submission je již uzavřena',
              errorCode: SUBMISSION_LOCKED_ERROR_CODE,
            });
          }
          const prismaErr = e as { code?: string };
          if (prismaErr.code === 'P2003' || prismaErr.code === 'P2023') {
            throw new BadRequestException('Nevalidní questionId');
          }
          throw e;
        }
      }
    });

    return { success: true };
  }

  async finish(
    id: string,
    dto: { responses?: RespInDto[] },
    user: JwtUser,
    ctx?: OrgContext,
  ) {
    const startMs = Date.now();
    const membership = ctx
      ? await this.getMembershipFromCtx(ctx)
      : await this.getActiveMembership(user);
    const submission = await this.prisma.submission.findUnique({
      where: scopedSubmissionWhere(membership.organizationId, id),
      include: {
        assignment: {
          select: {
            id: true,
            organizationId: true,
            closeAt: true,
            openAt: true,
            academicYear: {
              select: { id: true, startsAt: true, endsAt: true },
            },
          },
        },
        student: { select: { id: true, organizationId: true } },
        responses: { select: { id: true, questionId: true } },
        test: {
          select: {
            id: true,
            questions: {
              select: {
                id: true,
                type: true,
                correctAnswer: true,
                correctAnswers: true,
                score: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission nenalezena');
    if (!submission.assignment) {
      throw new NotFoundException('Submission nemá přiřazený assignment.');
    }
    if (String(membership.role) !== 'STUDENT') {
      throw new ForbiddenException('Only students can finish submissions.');
    }
    if (submission.studentId !== membership.id) {
      throw new ForbiddenException('Access denied');
    }
    // Idempotent: double-submit returns same payload (200)
    if (submission.submittedAt) {
      return submission;
    }

    // Year-boundary check is intentionally absent here: AcademicYearExpiredGuard is
    // not applied to submissions so students can finish a test they already started
    // even if the year expired between create() and finish(). The assignment closeAt
    // is the only hard deadline for submissions in progress.
    const now = new Date();
    if (now < submission.assignment.openAt)
      throw new BadRequestException('Assignment ještě není otevřen');
    if (now > submission.assignment.closeAt)
      throw new ForbiddenException('Assignment je uzavřen');

    const incoming = dto.responses ?? [];
    const assignmentId = submission.assignment.id;
    const organizationId = submission.assignment.organizationId;
    const testId = submission.test.id;

    const finished = await this.prisma.$transaction(async (tx) => {
      // Lock row so concurrent finish() blocks; second caller will see submittedAt set and return idempotent
      await tx.$queryRaw(
        Prisma.sql`SELECT submission_id FROM submissions WHERE submission_id = ${id} FOR UPDATE`,
      );

      const locked = await tx.submission.findUnique({
        where: { id },
        include: {
          assignment: {
            select: {
              id: true,
              organizationId: true,
              closeAt: true,
              openAt: true,
            },
          },
          responses: { select: { id: true, questionId: true } },
          test: {
            select: {
              id: true,
              questions: {
                select: {
                  id: true,
                  text: true,
                  type: true,
                  correctAnswer: true,
                  correctAnswers: true,
                  score: true,
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });
      if (!locked || !locked.assignment)
        throw new NotFoundException('Submission nenalezena');
      if (locked.submittedAt) return locked;

      if (incoming.length > 0) {
        const validQuestionIds = new Set(
          (locked.test?.questions ?? []).map((q) => q.id),
        );
        for (const r of incoming) {
          if (!validQuestionIds.has(r.questionId)) {
            throw new BadRequestException('Nevalidní questionId');
          }
          const existing = locked.responses.find(
            (x) => x.questionId === r.questionId,
          );
          if (existing) {
            await tx.response.update({
              where: { id: existing.id },
              data: { givenText: this.serializeGivenText(r.givenText) },
            });
          } else {
            await tx.response.create({
              data: {
                submissionId: id,
                questionId: r.questionId,
                givenText: this.serializeGivenText(r.givenText),
              },
            });
          }
        }
      }

      const dbResponses = await tx.response.findMany({
        where: { submissionId: id },
        select: { id: true, questionId: true, givenText: true },
      });

      const rawQuestions = locked.test?.questions ?? [];
      const questions = rawQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        correctAnswer: q.correctAnswer,
        correctAnswers: q.correctAnswers,
        score: q.score ?? 1,
      }));
      const scoreResult = computeScore(
        questions,
        dbResponses.map((r) => ({
          id: r.id,
          questionId: r.questionId,
          givenText: r.givenText,
        })),
      );

      this.logger.debug(
        JSON.stringify({
          event: 'scoring_result',
          submissionId: id,
          total: scoreResult.total,
          maxScore: scoreResult.maxScore,
          normalizedScore: scoreResult.normalizedScore,
          unscorableCount: scoreResult.unscorableQuestionIds.length,
          results: scoreResult.results.map((r) => ({
            qId: r.questionId,
            correct: r.correct,
            gained: r.gained,
          })),
        }),
      );

      // Build question lookup for immutable snapshot fields.
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      for (const item of scoreResult.results) {
        if (item.responseId) {
          const q = questionMap.get(item.questionId);
          const correctAnswerSnapshot = q
            ? (q.correctAnswer ??
              (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0
                ? JSON.stringify(q.correctAnswers)
                : null))
            : null;
          const maxPoints = q?.score ?? 1;
          await tx.response.update({
            where: { id: item.responseId },
            data: {
              isCorrect: item.correct,
              awardedPoints: item.gained,
              maxPoints,
              correctAnswerSnapshot,
              questionTextSnapshot: q?.text ?? null,
            },
          });
        }
      }

      if (scoreResult.unscorableQuestionIds.length > 0) {
        const rejected = await tx.submission.update({
          where: { id },
          data: {
            submittedAt: new Date(),
            status: SubmissionStatus.REJECTED,
            score: null,
            earnedPoints: null,
            maxPoints: scoreResult.maxScore,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.userId ?? null,
            organizationId,
            entityType: AuditEntityType.TEST,
            entityId: id,
            action: 'SUBMISSION_REJECT_UNSCORABLE',
            metadata: {
              assignmentId,
              attemptNo: rejected.attemptNo,
              unscorableQuestionIds: scoreResult.unscorableQuestionIds,
            },
          },
        });
        // Immutable analytics snapshot (fail-closed: any error rolls back finish()).
        await this.analyticsSnapshot.createSubmissionSnapshot(tx, id);
        return rejected;
      }

      const updated = await tx.submission.update({
        where: { id },
        data: {
          submittedAt: new Date(),
          status: SubmissionStatus.APPROVED,
          score: scoreResult.normalizedScore,
          earnedPoints: scoreResult.total,
          maxPoints: scoreResult.maxScore,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId ?? null,
          organizationId,
          entityType: AuditEntityType.TEST,
          entityId: id,
          action: 'SUBMISSION_FINISH',
          metadata: {
            assignmentId,
            attemptNo: updated.attemptNo,
            score: updated.score,
            earnedPoints: scoreResult.total,
            maxPoints: scoreResult.maxScore,
          },
        },
      });

      // Immutable analytics snapshot (fail-closed: any error rolls back finish()).
      await this.analyticsSnapshot.createSubmissionSnapshot(tx, id);

      return updated;
    });

    await this.gamification.awardXpForEvent(
      submission.studentId,
      XpEventType.TEST_COMPLETED,
      50,
      {
        assignmentId,
        testId,
        submissionId: finished.id,
      },
    );
    await this.gamification.evaluateBadgesForSubmission(
      submission.studentId,
      finished.id,
    );
    await this.invalidateSubmissionDerivedCaches(
      organizationId,
      'submissions.finish',
    );

    const durationMs = Date.now() - startMs;
    this.logger.log(
      JSON.stringify({
        event: 'submission_finish',
        submissionId: id,
        durationMs,
      }),
    );
    return finished;
  }

  async findAll(
    filter: { assignmentId?: string; studentId?: string },
    user: JwtUser,
    ctx: OrgContext,
    paging?: { page: number; limit: number },
  ) {
    const membership = await this.getMembershipFromCtx(ctx);
    const role = String(membership.role ?? '');
    const page = Math.max(1, paging?.page ?? 1);
    const limit = Math.min(100, Math.max(1, paging?.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SubmissionWhereInput = withOrg(
      {
        deletedAt: null,
        ...(filter.assignmentId ? { assignmentId: filter.assignmentId } : {}),
      },
      ctx.organizationId,
    );
    assertTenantWhere(where as Record<string, unknown>, ctx.organizationId);

    if (role === 'TEACHER') {
      const scope = await this.getTeacherAssignmentScope(membership.id);
      where.assignment = { OR: scope.OR };
    }

    if (role === 'STUDENT') {
      where.studentId = membership.id;
    } else if (filter.studentId) {
      where.studentId = filter.studentId;
    }

    const [total, submissions] = await this.prisma.$transaction([
      this.prisma.submission.count({ where }),
      this.prisma.submission.findMany({
        where,
        select: {
          id: true,
          assignmentId: true,
          testId: true,
          status: true,
          score: true,
          earnedPoints: true,
          maxPoints: true,
          submittedAt: true,
          attemptNo: true,
          isAnonymous: true,
          student: { select: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: submissions.map((s) =>
        this.sanitizeSubmission(s, role, { includeResponses: false }),
      ),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, user: JwtUser, ctx: OrgContext) {
    const membership = await this.getMembershipFromCtx(ctx);
    const role = String(membership.role ?? '');

    const submission = await this.prisma.submission.findUnique({
      where: scopedSubmissionWhere(membership.organizationId, id),
      select: {
        id: true,
        organizationId: true,
        studentId: true,
        testId: true,
        assignmentId: true,
        score: true,
        earnedPoints: true,
        maxPoints: true,
        status: true,
        submittedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        attemptNo: true,
        isAnonymous: true,
        responses: {
          select: {
            id: true,
            questionId: true,
            givenText: true,
            isCorrect: true,
          },
        },
        assignment: {
          select: {
            organizationId: true,
            createdById: true,
            classSectionId: true,
            test: {
              select: {
                questions: {
                  select: {
                    id: true,
                    type: true,
                    correctAnswer: true,
                    correctAnswers: true,
                    score: true,
                  },
                },
              },
            },
          },
        },
        student: { select: { user: { select: { name: true } } } },
      },
    });
    if (!submission || submission.deletedAt)
      throw new NotFoundException('Submission nenalezena');
    if (!submission.assignment) {
      throw new NotFoundException('Submission nemá přiřazený assignment.');
    }

    // ── Scoring integrity guard (log-only, no stored-value mutation) ──────────
    if (submission.assignment.test?.questions?.length) {
      const recomputed = computeScore(
        submission.assignment.test.questions,
        submission.responses,
      );
      const storedEarnedPoints = submission.earnedPoints ?? null;
      const storedMaxPoints = submission.maxPoints ?? null;
      const earnedMismatch = storedEarnedPoints !== recomputed.total;
      const maxMismatch = storedMaxPoints !== recomputed.maxScore;
      const normalizedMismatch =
        submission.score != null &&
        Math.abs(recomputed.normalizedScore - submission.score) > 0.01;
      if (earnedMismatch || maxMismatch || normalizedMismatch) {
        this.logger.warn('Submission score mismatch detected', {
          submissionId: submission.id,
          storedScore: submission.score,
          storedEarnedPoints,
          storedMaxPoints,
          recomputedScore: recomputed.normalizedScore,
          recomputedEarnedPoints: recomputed.total,
          recomputedMaxPoints: recomputed.maxScore,
        });
      }
    }

    if (role === 'STUDENT' && submission.studentId !== membership.id) {
      throw new ForbiddenException('Access denied');
    }

    if (role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { membershipId: membership.id, deletedAt: null },
        select: { id: true },
      });
      const createdByTeacher =
        submission.assignment?.createdById === membership.id;
      let teachesClass = false;
      if (teacher && submission.assignment?.classSectionId) {
        const cls = await this.prisma.classSection.findFirst({
          where: {
            id: submission.assignment.classSectionId,
            ...teacherClassScope(teacher.id),
          },
          select: { id: true },
        });
        teachesClass = !!cls;
      }
      if (!createdByTeacher && !teachesClass) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.sanitizeSubmission(submission, role);
  }

  /**
   * Records Focus Test Mode telemetry (tab blur / visibility / connectivity) as audit signals.
   *
   * This is NOT anti-cheat: nothing is blocked and the student sees no warning. It only writes
   * to the existing AuditLog (entityType TEST, entityId = submissionId, action `FOCUS_EVENT:*`)
   * for later review. It never reads or mutates responses or submission status, so it remains
   * safe to call even after the submission has been finished.
   */
  async logFocusEvents(
    id: string,
    dto: {
      events: Array<{
        type: FocusEventType;
        clientTimestamp: number;
        count?: number;
      }>;
    },
    user: JwtUser,
    ctx: OrgContext,
    reqMeta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<{ success: boolean; recorded: number }> {
    const membership = await this.getMembershipFromCtx(ctx);
    if (String(membership.role) !== 'STUDENT') {
      throw new ForbiddenException('Only students can log focus events.');
    }

    const submission = await this.prisma.submission.findUnique({
      where: scopedSubmissionWhere(membership.organizationId, id),
      select: {
        id: true,
        studentId: true,
        testId: true,
        assignmentId: true,
        assignment: { select: { organizationId: true } },
      },
    });
    if (!submission || !submission.assignment) {
      throw new NotFoundException('Submission nenalezena');
    }
    if (submission.studentId !== membership.id) {
      throw new ForbiddenException('Access denied');
    }

    const events = dto.events ?? [];
    if (events.length === 0) return { success: true, recorded: 0 };

    // Fire-and-forget at the AuditService level (it swallows missing-relation errors).
    for (const e of events) {
      await this.audit.log({
        action: `FOCUS_EVENT:${e.type.toUpperCase()}`,
        entityType: AuditEntityType.TEST,
        entityId: submission.id,
        userId: user.userId ?? null,
        organizationId: membership.organizationId,
        ipAddress: reqMeta.ipAddress,
        userAgent: reqMeta.userAgent,
        metadata: {
          eventType: e.type,
          submissionId: submission.id,
          assignmentId: submission.assignmentId,
          testId: submission.testId,
          clientTimestamp: e.clientTimestamp,
          count: e.count ?? 1,
        },
      });
    }

    return { success: true, recorded: events.length };
  }
}
