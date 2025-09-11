// src/submissions/submissions.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type JwtUser = {
  id: string; // user.id
  organizationId?: string | null;
  organizationRole?: string | null; // 'STUDENT' | 'TEACHER' | ...
  membershipId?: string | null; // Membership.id v aktuální org
  systemRole?: string | null; // SUPERADMIN?
};

type RespInDto = { questionId: string; givenText: any };

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

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
        where: { userId: user.id, organizationId: user.organizationId },
        select: { id: true, organizationId: true, role: true },
      });
      if (m) return m;
    }
    // poslední fallback: jakýkoli membership (pokud má jen jeden, je to OK)
    const m = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      select: { id: true, organizationId: true, role: true },
    });
    if (!m)
      throw new ForbiddenException('Nemáš aktivní členství v organizaci.');
    return m;
  }

  private assertSameOrg(orgA: string, orgB?: string | null) {
    if (orgA && orgB && orgA === orgB) return;
    throw new ForbiddenException('Cross-org access denied');
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
    this.assertSameOrg(assignment.organizationId, membership.organizationId);

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

    // přístup – student může editovat jen vlastní draft v rámci org
    const membership = await this.getActiveMembership(user);
    this.assertSameOrg(
      submission.assignment.organizationId,
      membership.organizationId,
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
            data: { givenText: r.givenText },
          });
        } else {
          await this.prisma.response.create({
            data: {
              submissionId: submission.id,
              questionId: r.questionId,
              givenText: r.givenText,
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

    const membership = await this.getActiveMembership(user);
    this.assertSameOrg(
      submission.assignment.organizationId,
      membership.organizationId,
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
              data: { givenText: r.givenText },
            });
          } else {
            await this.prisma.response.create({
              data: {
                submissionId: submission.id,
                questionId: r.questionId,
                givenText: r.givenText,
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

    for (const q of submission.test.questions) {
      const resp = dbResponses.find((r) => r.questionId === q.id);
      const given = resp?.givenText;

      let correct = false;
      let gained = 0;
      const qScore = q.score ?? 1;
      maxScore += qScore;

      if (q.type === QuestionType.TRUE_FALSE) {
        correct =
          String(given ?? '').toLowerCase() ===
          String(q.correctAnswer ?? '').toLowerCase();
        gained = correct ? qScore : 0;
      } else if (q.type === QuestionType.FILL_IN_THE_BLANK) {
        correct =
          this.normalizeFitb(String(given)) ===
          this.normalizeFitb(q.correctAnswer ?? '');
        gained = correct ? qScore : 0;
      } else if (q.type === QuestionType.MULTIPLE_CHOICE) {
        if (Array.isArray(q.correctAnswers)) {
          // multi: očekáváme pole – rovnost množin (po seřazení)
          const corr = [...q.correctAnswers].sort().join(',');
          const giv = Array.isArray(given)
            ? [...given].sort().join(',')
            : String(given ?? '');
          correct = corr === giv;
        } else {
          // single: string
          correct = String(given ?? '') === String(q.correctAnswer ?? '');
        }
        gained = correct ? qScore : 0;
      }

      if (resp) {
        await this.prisma.response.update({
          where: { id: resp.id },
          data: { isCorrect: correct },
        });
      }
      total += gained;
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

    return finished;
  }

  async findAll(
    filter: { assignmentId?: string; studentId?: string },
    user: JwtUser,
  ) {
    const membership = await this.getActiveMembership(user);

    const where: Prisma.SubmissionWhereInput = {
      assignment: { organizationId: membership.organizationId },
    };

    if (filter.assignmentId) where.assignmentId = filter.assignmentId;

    // STUDENT vidí jen své
    if (String(membership.role) === 'STUDENT') {
      where.studentId = membership.id;
    } else if (filter.studentId) {
      where.studentId = filter.studentId;
    }

    return this.prisma.submission.findMany({
      where,
      include: { responses: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtUser) {
    const membership = await this.getActiveMembership(user);

    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        responses: true,
        assignment: { select: { organizationId: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission nenalezena');

    this.assertSameOrg(
      submission.assignment.organizationId,
      membership.organizationId,
    );

    if (
      String(membership.role) === 'STUDENT' &&
      submission.studentId !== membership.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return submission;
  }
}
