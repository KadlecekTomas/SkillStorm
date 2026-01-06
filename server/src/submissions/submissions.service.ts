// src/submissions/submissions.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AuditEntityType,
  QuestionType,
  SubmissionStatus,
  XpEventType,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { assertSameOrganizationIds } from '@/shared/access.utils';
import { GamificationService } from '@/gamification/gamification.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';

type JwtUser = JwtPayload;

type RespInDto = { questionId: string; givenText: any };

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  // ---- helpers -------------------------------------------------------------

  private async getActiveMembership(user: JwtUser) {
    if (user.membershipId) {
      const m = await this.prisma.membership.findUnique({
        where: { id: user.membershipId },
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
        where: { userId: user.userId, organizationId: user.organizationId },
        select: { id: true, organizationId: true, role: true },
      });
      if (m) return m;
    }
    // poslední fallback: jakýkoli membership (pokud má jen jeden, je to OK)
    const m = await this.prisma.membership.findFirst({
      where: { userId: user.userId },
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
        ...(teacher ? [{ classSection: { teacherId: teacher.id } }] : []),
      ],
    };
  }

  private sanitizeSubmission(
    submission: {
      id: string;
      assignmentId: string | null;
      testId: string;
      status: SubmissionStatus;
      score: number | null;
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
  ) {
    return {
      id: submission.id,
      assignmentId: submission.assignmentId,
      testId: submission.testId,
      status: submission.status,
      score: submission.score,
      submittedAt: submission.submittedAt,
      attemptNo: submission.attemptNo,
      isAnonymous: submission.isAnonymous ?? false,
      responses:
        submission.responses?.map((r) => ({
          questionId: r.questionId,
          givenText: r.givenText,
          isCorrect: r.isCorrect,
        })) ?? [],
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

  // ---- API methods ---------------------------------------------------------

  async create(dto: { assignmentId: string }, user: JwtUser) {
    // 1) assignment + test + (při cílení na STUDENTS i seznam studentů)
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: dto.assignmentId },
      include: {
        test: { select: { id: true, organizationId: true } },
        students: { select: { studentId: true } }, // AssignmentStudent[]
      },
    });
    if (!assignment) throw new NotFoundException('Assignment nenalezen');

    // 2) membership studenta (nebo učitele – ale submission dává smysl pro STUDENTa)
    const membership = await this.getActiveMembership(user);

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

    // 5) okno otevření
    const now = new Date();
    if (now < assignment.openAt)
      throw new BadRequestException('Assignment ještě není otevřen');
    if (now > assignment.closeAt)
      throw new BadRequestException('Assignment je uzavřen');

    // 6) maxAttempts
    const attempts = await this.prisma.submission.count({
      where: { assignmentId: assignment.id, studentId: membership.id },
    });
    if (attempts >= assignment.maxAttempts) {
      throw new BadRequestException('Vyčerpán maximální počet pokusů');
    }

    // 7) vytvoř submission (PENDING draft)
    return this.prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        testId: assignment.testId,
        studentId: membership.id,
        attemptNo: attempts + 1,
        status: SubmissionStatus.PENDING,
      },
    });
  }

  async updateResponses(
    id: string,
    dto: { responses?: RespInDto[] },
    user: JwtUser,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
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

    // přístup – student může editovat jen vlastní draft v rámci org
    const membership = await this.getActiveMembership(user);
    assertSameOrganizationIds(
      submission.assignment.organizationId,
      membership.organizationId,
      'submission',
    );

    if (submission.studentId !== membership.id) {
      throw new ForbiddenException('Access denied');
    }
    if (submission.submittedAt) {
      throw new BadRequestException('Submission je již uzavřena');
    }

    // responses jsou volitelné – pokud nejsou, jen vrátíme OK (v souladu s DTO)
    const list = dto.responses ?? [];
    if (list.length === 0) return { success: true };

    // Validate questionId before upsert
    // Get all valid questionIds for this assignment's test
    const test = await this.prisma.test.findUnique({
      where: { id: submission.testId },
      select: { questions: { select: { id: true } } },
    });
    const validQuestionIds = new Set((test?.questions ?? []).map((q) => q.id));

    for (const r of list) {
      if (!validQuestionIds.has(r.questionId)) {
        throw new BadRequestException('Nevalidní questionId');
      }
      const existing = submission.responses.find(
        (x) => x.questionId === r.questionId,
      );
      try {
        if (existing) {
          await this.prisma.response.update({
            where: { id: existing.id },
            data: { givenText: this.serializeGivenText(r.givenText) },
          });
        } else {
          await this.prisma.response.create({
            data: {
              submissionId: submission.id,
              questionId: r.questionId,
              givenText: this.serializeGivenText(r.givenText),
            },
          });
        }
      } catch (e: any) {
        // Catch Prisma errors for invalid UUID or FK
        if (e.code === 'P2003' || e.code === 'P2023') {
          throw new BadRequestException('Nevalidní questionId');
        }
        throw e;
      }
    }
    return { success: true };
  }

  async finish(id: string, dto: { responses?: RespInDto[] }, user: JwtUser) {
    const submission = await this.prisma.submission.findUnique({
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

    const membership = await this.getActiveMembership(user);
    assertSameOrganizationIds(
      submission.assignment.organizationId,
      membership.organizationId,
      'submission',
    );

    if (submission.studentId !== membership.id) {
      throw new ForbiddenException('Access denied');
    }
    if (submission.submittedAt) {
      throw new BadRequestException('Submission již byla odevzdána');
    }

    // okno – po deadline zakázat
    const now = new Date();
    if (now < submission.assignment.openAt)
      throw new BadRequestException('Assignment ještě není otevřen');
    if (now > submission.assignment.closeAt)
      throw new ForbiddenException('Assignment je uzavřen');

    // responses z DTO jsou volitelné – pokud při finish dorazí, promítneme je (upsert)
    const incoming = dto.responses ?? [];
    if (incoming.length > 0) {
      // Validate questionId before upsert
      const test = submission.test;
      const validQuestionIds = new Set(
        (test?.questions ?? []).map((q) => q.id),
      );
      for (const r of incoming) {
        if (!validQuestionIds.has(r.questionId)) {
          throw new BadRequestException('Nevalidní questionId');
        }
        const existing = submission.responses.find(
          (x) => x.questionId === r.questionId,
        );
        try {
          if (existing) {
          await this.prisma.response.update({
            where: { id: existing.id },
            data: { givenText: this.serializeGivenText(r.givenText) },
          });
        } else {
          await this.prisma.response.create({
            data: {
              submissionId: submission.id,
              questionId: r.questionId,
              givenText: this.serializeGivenText(r.givenText),
            },
          });
        }
        } catch (e: any) {
          if (e.code === 'P2003' || e.code === 'P2023') {
            throw new BadRequestException('Nevalidní questionId');
          }
          throw e;
        }
      }
    }

    // načti responses po případném upsertu
    const dbResponses = await this.prisma.response.findMany({
      where: { submissionId: submission.id },
      select: { id: true, questionId: true, givenText: true },
    });

    // auto-scoring
    let total = 0;
    let maxScore = 0;
    const unscorableQuestions: string[] = [];

    for (const q of submission.test.questions) {
      const resp = dbResponses.find((r) => r.questionId === q.id);
      const given = resp?.givenText;

      let correct: boolean | null = false;
      let gained = 0;
      const qScore = q.score ?? 1;

      const correctAnswer = this.normalizeText(q.correctAnswer ?? null);
      const correctAnswers = this.normalizeAnswerList(q.correctAnswers ?? []);
      const hasSingle = !!correctAnswer;
      const hasMulti = correctAnswers.length > 0;

      let mode: 'single' | 'multi' | null = null;
      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        if (hasSingle && hasMulti) {
          mode = null;
        } else if (hasMulti) {
          mode = 'multi';
        } else if (hasSingle) {
          mode = 'single';
        }
      } else if (
        q.type === QuestionType.TRUE_FALSE ||
        q.type === QuestionType.FILL_IN_THE_BLANK
      ) {
        mode = hasSingle ? 'single' : null;
      }

      if (!mode) {
        unscorableQuestions.push(q.id);
        if (resp) {
          await this.prisma.response.update({
            where: { id: resp.id },
            data: { isCorrect: null },
          });
        }
        continue;
      }

      maxScore += qScore;

      if (q.type === QuestionType.TRUE_FALSE) {
        correct =
          String(given ?? '').toLowerCase() ===
          String(correctAnswer ?? '').toLowerCase();
        gained = correct ? qScore : 0;
      } else if (q.type === QuestionType.FILL_IN_THE_BLANK) {
        correct =
          this.normalizeFitb(String(given)) ===
          this.normalizeFitb(correctAnswer ?? '');
        gained = correct ? qScore : 0;
      } else if (q.type === QuestionType.MULTIPLE_CHOICE) {
        if (mode === 'multi') {
          // multi: očekáváme pole – rovnost množin (po seřazení)
          const corr = [...correctAnswers].sort().join(',');
          const giv = this.normalizeAnswerList(given).sort().join(',');
          correct = corr === giv;
        } else {
          // single: string
          const givenSingle = Array.isArray(given) ? given[0] : given;
          correct = String(givenSingle ?? '') === String(correctAnswer ?? '');
        }
        gained = correct ? qScore : 0;
      }

      if (resp) {
        await this.prisma.response.update({
          where: { id: resp.id },
          data: { isCorrect: correct ?? null },
        });
      }
      total += gained;
    }

    if (unscorableQuestions.length > 0) {
      const rejected = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          submittedAt: new Date(),
          status: SubmissionStatus.REJECTED,
          score: null,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: user.userId ?? null,
          organizationId: submission.assignment.organizationId,
          entityType: AuditEntityType.TEST,
          entityId: submission.id,
          action: 'SUBMISSION_REJECT_UNSCORABLE',
          metadata: {
            assignmentId: submission.assignment.id,
            attemptNo: rejected.attemptNo,
            unscorableQuestionIds: unscorableQuestions,
          },
        },
      });

      return rejected;
    }

    // Normalizace skóre na 0–1
    const normalizedScore = maxScore > 0 ? total / maxScore : 0;

    const finished = await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        submittedAt: new Date(),
        status: SubmissionStatus.APPROVED,
        score: normalizedScore,
      },
    });

    await this.gamification.awardXpForEvent(
      submission.studentId,
      XpEventType.TEST_COMPLETED,
      50,
      {
        assignmentId: submission.assignment.id,
        testId: submission.test.id,
        submissionId: submission.id,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user.userId ?? null,
        organizationId: submission.assignment.organizationId,
        entityType: AuditEntityType.TEST,
        entityId: submission.id,
        action: 'SUBMISSION_FINISH',
        metadata: {
          assignmentId: submission.assignment.id,
          attemptNo: finished.attemptNo,
          score: finished.score,
        },
      },
    });

    return finished;
  }

  async findAll(
    filter: { assignmentId?: string; studentId?: string },
    user: JwtUser,
  ) {
    const membership = await this.getActiveMembership(user);
    const role = String(membership.role ?? '');

    const baseAssignment: Prisma.AssignmentWhereInput = {
      organizationId: membership.organizationId,
    };

    if (role === 'TEACHER') {
      const scope = await this.getTeacherAssignmentScope(membership.id);
      baseAssignment.OR = scope.OR;
    }

    const where: Prisma.SubmissionWhereInput = {
      assignment: baseAssignment,
      deletedAt: null,
      ...(filter.assignmentId ? { assignmentId: filter.assignmentId } : {}),
    };

    // STUDENT vidí jen své
    if (role === 'STUDENT') {
      where.studentId = membership.id;
    } else if (filter.studentId) {
      where.studentId = filter.studentId;
    }

    const submissions = await this.prisma.submission.findMany({
      where,
      include: {
        responses: {
          select: {
            id: true,
            questionId: true,
            givenText: true,
            isCorrect: true,
          },
        },
        student: { select: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((s) => this.sanitizeSubmission(s, role));
  }

  async findOne(id: string, user: JwtUser) {
    const membership = await this.getActiveMembership(user);
    const role = String(membership.role ?? '');

    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        responses: {
          select: {
            id: true,
            questionId: true,
            givenText: true,
            isCorrect: true,
          },
        },
        assignment: {
          select: { organizationId: true, createdById: true, classSectionId: true },
        },
        student: { select: { user: { select: { name: true } } } },
      },
    });
    if (!submission || submission.deletedAt)
      throw new NotFoundException('Submission nenalezena');
    if (!submission.assignment) {
      throw new NotFoundException('Submission nemá přiřazený assignment.');
    }

    assertSameOrganizationIds(
      submission.assignment.organizationId,
      membership.organizationId,
      'submission',
    );

    if (
      role === 'STUDENT' &&
      submission.studentId !== membership.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { membershipId: membership.id, deletedAt: null },
        select: { id: true },
      });
      const createdByTeacher = submission.assignment?.createdById === membership.id;
      let homeroomMatch = false;
      if (teacher && submission.assignment?.classSectionId) {
        const cls = await this.prisma.classSection.findFirst({
          where: {
            id: submission.assignment.classSectionId,
            teacherId: teacher.id,
          },
          select: { id: true },
        });
        homeroomMatch = !!cls;
      }
      if (!createdByTeacher && !homeroomMatch) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.sanitizeSubmission(submission, role);
  }
}
