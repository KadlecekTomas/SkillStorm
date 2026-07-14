// src/tests/tests.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  Prisma,
  AuditEntityType,
  SchoolGrade,
  SystemRole,
  OrganizationRole,
  PublishStatus,
  EnrollmentStatus,
} from '@prisma/client';
import type { CreateTestDto } from './dto/create-test.dto';
import type { UpdateTestDto } from './dto/update-test.dto';
import type { QueryTestsDto } from './dto/query-tests.dto';
import type { CreateQuestionDto } from './dto/create-question.dto';
import type { UpdateQuestionDto } from './dto/update-question.dto';
import type { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import type { CreateOptionDto } from './dto/create-option.dto';
import type { UpdateOptionDto } from './dto/update-option.dto';
import type { CreateAnswerDto } from './dto/create-answer.dto';
import type { UpdateAnswerDto } from './dto/update-answer.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { AssignTestDto } from './dto/assign-test.dto';
import { hasAtLeastRole } from '@/shared/access.utils';

import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';
import {
  computeAssignability,
  type AssignabilityReport,
} from '@/shared/test-assignability.util';
import {
  deriveOrgReadiness,
  OrgReadinessState,
} from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import { OrgOperationType } from '@/common/decorators/org-operation.decorator';
import type {
  TeacherTestViewDTO,
  TestEditMode,
} from './dto/teacher-test-view.dto';
import type { StudentTestViewDTO } from './dto/student-test-view.dto';
import { assertTenantWhere, withOrg } from '@/common/prisma/tenant-scope';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { safePercent, ratioToPercent } from '@/common/math/safe-percent';

function searchExpr(search?: string): Prisma.TestWhereInput | undefined {
  const s = search?.trim();
  if (!s) return undefined;
  return {
    OR: [
      { title: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
    ],
  };
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /**
   * Compute per-test submission statistics for the teacher/director list view.
   * Two groupBy queries (one for submitted, one for all started) are batched
   * to avoid N+1 and keep the result fresh outside the list cache.
   *
   * Returns a map keyed by testId.
   */
  private async computeTestStats(testIds: string[]): Promise<
    Record<
      string,
      {
        submissions: number;
        avgScore: number | null;
        completionRate: number | null;
      }
    >
  > {
    if (testIds.length === 0) return {};

    // Submitted submissions → avgScore + submittedCount
    const submittedGroups = await this.prisma.submission.groupBy({
      by: ['testId'],
      where: {
        testId: { in: testIds },
        submittedAt: { not: null },
        deletedAt: null,
      },
      _count: { _all: true },
      _avg: { score: true },
    });

    // All non-deleted submissions → denominator for completionRate
    const allGroups = await this.prisma.submission.groupBy({
      by: ['testId'],
      where: { testId: { in: testIds }, deletedAt: null },
      _count: { _all: true },
    });

    const submittedMap = new Map(submittedGroups.map((g) => [g.testId, g]));
    const allCountMap = new Map(
      allGroups.map((g) => [g.testId, g._count._all]),
    );

    return Object.fromEntries(
      testIds.map((id) => {
        const sub = submittedMap.get(id);
        const totalStarted = allCountMap.get(id) ?? 0;
        const submittedCount = sub?._count._all ?? 0;
        // score is stored as 0..1 ratio; convert to 0..100 percentage
        const avgRaw = sub?._avg.score ?? null;

        return [
          id,
          {
            submissions: submittedCount,
            avgScore: ratioToPercent(avgRaw),
            completionRate: safePercent(submittedCount, totalStarted),
          },
        ];
      }),
    );
  }

  private testListSelect() {
    return Prisma.validator<Prisma.TestSelect>()({
      id: true,
      organizationId: true,
      title: true,
      description: true,
      allowedGrades: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: {
          id: true,
          name: true,
          catalogSubject: { select: { code: true, name: true } },
        },
      },
      academicYear: {
        select: { id: true, label: true, isCurrent: true },
      },
      creator: {
        select: {
          id: true,
          organizationId: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    });
  }

  private teacherDetailSelect() {
    return Prisma.validator<Prisma.TestSelect>()({
      id: true,
      organizationId: true,
      title: true,
      description: true,
      allowedGrades: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: {
          id: true,
          name: true,
          catalogSubject: { select: { code: true, name: true } },
        },
      },
      academicYear: {
        select: { id: true, label: true, isCurrent: true },
      },
      creator: {
        select: {
          id: true,
          organizationId: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      questions: true,
      _count: {
        select: {
          submissions: true,
        },
      },
      assignments: {
        select: {
          id: true,
          topicLevelId: true,
          isPrimary: true,
          topicLevel: {
            select: {
              id: true,
              catalogTopic: { select: { id: true, name: true } },
              subjectLevel: { select: { grade: true } },
            },
          },
        },
      },
    });
  }

  private studentDetailSelect() {
    return Prisma.validator<Prisma.TestSelect>()({
      id: true,
      organizationId: true,
      title: true,
      description: true,
      allowedGrades: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: {
          id: true,
          name: true,
          catalogSubject: { select: { code: true, name: true } },
        },
      },
      academicYear: {
        select: { id: true, label: true, isCurrent: true },
      },
      questions: {
        select: {
          id: true,
          text: true,
          type: true,
          options: { select: { id: true, text: true } },
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      },
    });
  }

  /**
   * Centralized projection builder for every test response surface.
   * STUDENT never receives answer key fields.
   */
  private buildTestProjection(
    role: OrganizationRole | null,
    mode: 'list' | 'detail',
  ): Prisma.TestSelect {
    if (mode === 'list') {
      return this.testListSelect();
    }
    if (role === OrganizationRole.STUDENT) {
      return this.studentDetailSelect();
    }
    return this.teacherDetailSelect();
  }

  private mapTeacherView(
    test: unknown,
    assignability: AssignabilityReport,
    editMode: TestEditMode,
  ): TeacherTestViewDTO {
    const teacherTest = test as Record<string, unknown> & {
      _count?: { submissions?: number };
    };
    return {
      ...teacherTest,
      submissionCount: teacherTest._count?.submissions ?? 0,
      editMode,
      assignability,
    } as TeacherTestViewDTO;
  }

  private async testHasSubmissions(testId: string): Promise<boolean> {
    const count = await this.prisma.submission.count({
      where: {
        testId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  private async resolveTestEditMode(testId: string): Promise<TestEditMode> {
    const hasSubmissions = await this.testHasSubmissions(testId);
    return hasSubmissions ? 'LIMITED' : 'FULL';
  }

  /**
   * Edit mode for a VIEW context: unlike canEditTest (which throws for
   * non-editors and backs mutating endpoints), a read of the detail by a
   * same-org non-author teacher is legal and simply yields editMode 'NONE'.
   */
  private async resolveEditModeForView(
    testId: string,
    user: JwtPayload,
  ): Promise<TestEditMode> {
    try {
      return await this.canEditTest(testId, user);
    } catch (err) {
      if (err instanceof ForbiddenException) return 'NONE';
      throw err;
    }
  }

  async canEditTest(testId: string, user: JwtPayload): Promise<TestEditMode> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        organizationId: true,
        creatorId: true,
        deletedAt: true,
      },
    });
    if (!test || test.deletedAt) {
      throw new NotFoundException('Test nenalezen');
    }

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId !== test.organizationId
    ) {
      throw new NotFoundException('Test nenalezen');
    }

    await this.ensureCanEditTest(user, test);
    return this.resolveTestEditMode(testId);
  }

  private async ensureQuestionMutationsAllowed(testId: string): Promise<void> {
    const editMode = await this.resolveTestEditMode(testId);
    if (editMode !== 'FULL') {
      throw new ConflictException({
        code: 'TEST_QUESTIONS_LOCKED',
        message: 'Test has submissions. Question editing is locked.',
      });
    }
  }

  private mapStudentView(test: unknown): StudentTestViewDTO {
    return test as StudentTestViewDTO;
  }

  private async ensureStudentCanAccessTest(
    user: JwtPayload,
    testId: string,
    organizationId: string,
    testAcademicYearId: string | null,
  ): Promise<void> {
    if (
      user.organizationRole !== OrganizationRole.STUDENT ||
      !user.membershipId
    ) {
      return;
    }

    const student = await this.prisma.student.findFirst({
      where: {
        membershipId: user.membershipId,
        orgId: organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!student) {
      throw new ForbiddenException('Access denied');
    }

    // Scope enrollments to the test's academic year (prevents cross-year class leakage).
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
        ...(testAcademicYearId ? { yearId: testAcademicYearId } : {}),
      },
      select: { classSectionId: true },
    });
    const classIds = enrollments.map((x) => x.classSectionId);

    // Check: assignment exists for this test targeting the student's class (or directly).
    // No time-window filter — students can view tests they were assigned to even after
    // the window closes (they need to see their submission results).
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        organizationId,
        testId,
        ...(testAcademicYearId ? { yearId: testAcademicYearId } : {}),
        OR: [
          { students: { some: { studentId: user.membershipId } } },
          ...(classIds.length > 0
            ? [{ classSectionId: { in: classIds } }]
            : []),
        ],
      },
      select: { id: true },
    });

    if (assignment) return;

    // Fallback: allow if the student already has a submission (assignment may have been removed).
    const ownSubmission = await this.prisma.submission.findFirst({
      where: {
        organizationId,
        testId,
        studentId: user.membershipId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!ownSubmission) {
      throw new ForbiddenException('Access denied');
    }
  }

  /** Validate that subjectId is enabled for the organization through OrgSubject. */
  private async validateSubject(
    subjectId: string,
    organizationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const orgSubject = await db.orgSubject.findFirst({
      where: {
        organizationId,
        subjectId,
        isEnabled: true,
        subject: {
          deletedAt: null,
        },
      },
      select: { id: true },
    });
    if (!orgSubject) {
      throw new BadRequestException({
        code: 'SUBJECT_NOT_ENABLED_FOR_ORGANIZATION',
        message:
          'Předmět není pro tuto organizaci povolen. Aktivujte jej v nastavení školy.',
      });
    }
  }

  /**
   * Resolve academicYearId: validate it belongs to the org and is not soft-deleted.
   * If academicYearId is omitted, fall back to ctx.activeAcademicYearId and verify
   * it against the DB — never trust the cached context value blindly.
   * Returns the resolved year id.
   */
  private async resolveAcademicYear(
    ctx: OrgContext,
    academicYearId: string | undefined,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    if (academicYearId) {
      const year = await db.academicYear.findFirst({
        where: {
          id: academicYearId,
          orgId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!year) {
        throw new BadRequestException({
          code: 'INVALID_ACADEMIC_YEAR',
          message:
            'Školní rok neexistuje, nepatří do organizace, nebo byl smazán.',
        });
      }
      return year.id;
    }

    // Fallback: ctx.activeAcademicYearId comes from a short-lived cache —
    // verify the year still exists in the DB and has not been soft-deleted.
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ACADEMIC_YEAR',
        message:
          'Není aktivní školní rok. Požádejte ředitele o nastavení aktívního roku.',
      });
    }
    const fallbackYear = await db.academicYear.findFirst({
      where: {
        id: ctx.activeAcademicYearId,
        orgId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!fallbackYear) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ACADEMIC_YEAR',
        message:
          'Aktivní školní rok byl smazán nebo je neplatný. Požádejte ředitele o aktualizaci.',
      });
    }
    return fallbackYear.id;
  }

  // ----- Audit helper -----
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    ip?: string | null;
    ua?: string | null;
    changedFields?: Record<string, unknown>;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      entityType: AuditEntityType.TEST,
      entityId: opts.entityId ?? null,
      action: opts.action,
      ipAddress: opts.ip ?? null,
      userAgent: opts.ua ?? null,
    };
    if (opts.changedFields !== undefined) {
      data.changedFields = opts.changedFields as Prisma.InputJsonValue;
    }
    return this.prisma.auditLog.create({ data }).then(() => undefined);
  }

  private async resolveOrgMembership(user: JwtPayload, organizationId: string) {
    if (user.systemRole === SystemRole.SUPERADMIN) return null;
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, role: true, organizationId: true },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return membership;
  }

  /**
   * Returns all ClassSection IDs that the given teacher (by membershipId) is allowed
   * to view results for: homeroom classes UNION active scoped teacher access.
   */
  private async resolveTeacherAllowedClassSectionIds(
    membershipId: string,
    orgId: string,
    academicYearId: string,
  ): Promise<string[]> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { membershipId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return [];
    const now = new Date();

    const [homeroom, taught] = await Promise.all([
      this.prisma.classSection.findMany({
        where: { orgId, yearId: academicYearId, teacherId: teacher.id },
        select: { id: true },
      }),
      this.prisma.teacherClassSection.findMany({
        where: {
          teacherId: teacher.id,
          deletedAt: null,
          classSection: { orgId, yearId: academicYearId },
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
        },
        select: { classSectionId: true },
      }),
    ]);

    return Array.from(
      new Set([
        ...homeroom.map((x) => x.id),
        ...taught.map((x) => x.classSectionId),
      ]),
    );
  }

  // ----- Permissions -----
  private async ensureCanEditTest(
    user: JwtPayload,
    test: { organizationId: string; creatorId: string },
  ) {
    if (user.systemRole === SystemRole.SUPERADMIN) return;

    const sameOrg = user.organizationId === test.organizationId;
    if (!sameOrg) throw new ForbiddenException('Cizí organizace.');

    const isDirector = hasAtLeastRole(
      user.organizationRole ?? null,
      OrganizationRole.DIRECTOR,
    );
    if (isDirector) return;

    const isAuthor = await this.prisma.membership.findFirst({
      where: { id: test.creatorId, userId: user.userId, deletedAt: null },
      select: { id: true },
    });
    if (!isAuthor)
      throw new ForbiddenException(
        'Upravovat může jen autor nebo ředitel/owner.',
      );
  }

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAnswerList(value?: string[] | null): string[] | null {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v).trim()).filter((v) => v.length > 0);
  }

  private buildAnswerFields(params: {
    type: string;
    correctAnswer?: string | null | undefined;
    correctAnswers?: string[] | null | undefined;
    existing?: { correctAnswer: string | null; correctAnswers: string[] };
  }) {
    const { type, existing } = params;
    const hasAnswerInput = params.correctAnswer !== undefined;
    const hasAnswersInput = params.correctAnswers !== undefined;

    const normalizedAnswer = this.normalizeText(params.correctAnswer ?? null);
    const normalizedAnswers = this.normalizeAnswerList(
      params.correctAnswers ?? null,
    );

    if (hasAnswerInput && !normalizedAnswer) {
      throw new BadRequestException('correctAnswer must be a non-empty string');
    }
    if (hasAnswersInput) {
      if (!normalizedAnswers || normalizedAnswers.length === 0) {
        throw new BadRequestException(
          'correctAnswers must be a non-empty array',
        );
      }
      const unique = new Set(normalizedAnswers);
      if (unique.size !== normalizedAnswers.length) {
        throw new BadRequestException('correctAnswers contains duplicates');
      }
    }

    if (type === 'TRUE_FALSE' || type === 'FILL_IN_THE_BLANK') {
      if (hasAnswersInput && (normalizedAnswers?.length ?? 0) > 0) {
        throw new BadRequestException(
          'correctAnswers is not allowed for this question type',
        );
      }
      return {
        correctAnswer: hasAnswerInput
          ? normalizedAnswer
          : (existing?.correctAnswer ?? null),
        correctAnswers: [],
      };
    }

    if (type === 'MULTIPLE_CHOICE') {
      if (hasAnswerInput && hasAnswersInput) {
        throw new BadRequestException(
          'Use either correctAnswer or correctAnswers for MULTIPLE_CHOICE',
        );
      }
      if (hasAnswersInput) {
        return { correctAnswer: null, correctAnswers: normalizedAnswers ?? [] };
      }
      if (hasAnswerInput) {
        return { correctAnswer: normalizedAnswer, correctAnswers: [] };
      }
      return {
        correctAnswer: existing?.correctAnswer ?? null,
        correctAnswers: existing?.correctAnswers ?? [],
      };
    }

    return {
      correctAnswer: hasAnswerInput
        ? normalizedAnswer
        : (existing?.correctAnswer ?? null),
      correctAnswers: existing?.correctAnswers ?? [],
    };
  }

  private async computeTestAssignability(
    testId: string,
  ): Promise<AssignabilityReport> {
    const [test, topicCount] = await Promise.all([
      this.prisma.test.findUnique({
        where: { id: testId },
        select: {
          allowedGrades: true,
          questions: {
            select: {
              id: true,
              type: true,
              correctAnswer: true,
              correctAnswers: true,
              score: true,
              options: {
                select: { text: true },
              },
            },
          },
        },
      }),
      this.prisma.testAssignment.count({ where: { testId } }),
    ]);
    const report = computeAssignability(
      test?.questions ?? [],
      test?.allowedGrades ?? [],
    );
    if (topicCount === 0) {
      report.issues.push({ reason: 'NO_TOPIC_ASSIGNMENT' });
      report.reasons.noTopicAssignments = 1;
      report.isAssignable = false;
    }
    return report;
  }

  private throwIfNotAssignable(report: AssignabilityReport): void {
    if (!report.isAssignable) {
      throw new ConflictException({
        errorCode: 'TEST_NOT_ASSIGNABLE',
        code: 'TEST_NOT_ASSIGNABLE',
        message: 'Test nemá přiřazené téma nebo není připraven k publikaci',
        reasons: report.reasons,
        details: report,
      });
    }
  }

  // ====== TESTS ===================================================
  async create(
    dto: CreateTestDto,
    user: JwtPayload,
    ctx: OrgContext,
  ): Promise<unknown> {
    const orgId = ctx.organizationId;

    const author = await this.prisma.membership.findFirst({
      where: { userId: user.userId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!author) {
      throw new ForbiddenException('Nejste členem organizace.');
    }

    if (dto.status === PublishStatus.PUBLISHED) {
      throw new BadRequestException(
        'Publish requires questions to be created first. Create test as DRAFT.',
      );
    }

    // Validate subject and year atomically — no test.create before both pass.
    const created = await this.prisma.$transaction(async (tx) => {
      await this.validateSubject(dto.subjectId, orgId, tx);
      const yearId = await this.resolveAcademicYear(
        ctx,
        dto.academicYearId,
        tx,
      );

      return tx.test.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          organizationId: orgId,
          subjectId: dto.subjectId,
          academicYearId: yearId,
          allowedGrades: dto.allowedGrades ?? [],
          status: dto.status ?? PublishStatus.DRAFT,
          creatorId: author.id,
        },
        select: this.buildTestProjection(
          user.organizationRole ?? OrganizationRole.DIRECTOR,
          'detail',
        ),
      });
    });

    // Auto-create TestAssignment rows when a catalogTopicId is provided.
    if (dto.catalogTopicId) {
      const topicLevels = await this.prisma.topicLevel.findMany({
        where: {
          catalogTopicId: dto.catalogTopicId,
          subjectLevel: { subjectId: dto.subjectId },
        },
        select: { id: true },
      });
      if (topicLevels.length > 0) {
        await this.prisma.testAssignment.createMany({
          data: topicLevels.map((tl, idx) => ({
            testId: created.id,
            topicLevelId: tl.id,
            isPrimary: idx === 0,
          })),
          skipDuplicates: true,
        });
      } else {
        this.logger.warn(
          `[create] catalogTopicId=${dto.catalogTopicId} matched no TopicLevel rows for subjectId=${dto.subjectId}`,
        );
      }
    }

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TEST_CREATE',
      entityId: created.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));
    return created;
  }

  async findAll(
    user: JwtPayload,
    q: QueryTestsDto,
    ctx: OrgContext,
  ): Promise<unknown> {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;

    const effectiveOrgId = isSuper
      ? (q.organizationId ?? null)
      : (user.organizationId ?? null);

    if (!isSuper) {
      if (!effectiveOrgId) {
        throw new ForbiddenException('Missing organization context.');
      }
      const member = user.membershipId
        ? await this.prisma.membership.findFirst({
            where: {
              id: user.membershipId,
              userId: user.userId,
              organizationId: effectiveOrgId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : await this.prisma.membership.findFirst({
            where: {
              userId: user.userId,
              organizationId: effectiveOrgId,
              deletedAt: null,
            },
            select: { id: true },
          });
      if (!member) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (user.organizationRole === OrganizationRole.STUDENT) {
      if (!effectiveOrgId || !user.membershipId) {
        throw new ForbiddenException('Access denied');
      }
      const student = await this.prisma.student.findFirst({
        where: {
          membershipId: user.membershipId,
          orgId: effectiveOrgId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!student) {
        return { items: [], meta: { page, limit, total: 0, pages: 1 } };
      }
      // Resolve active year FIRST so enrollment + assignment queries can be year-scoped.
      const activeYearId = q.academicYearId ?? ctx.activeAcademicYearId;

      // Enrollments are scoped to the active academic year to prevent cross-year class leakage.
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          studentId: student.id,
          status: { not: EnrollmentStatus.LEFT },
          ...(activeYearId ? { yearId: activeYearId } : {}),
        },
        select: { classSectionId: true },
      });
      const classIds = enrollments.map((e) => e.classSectionId);
      const assignmentWhere: Prisma.AssignmentWhereInput = {
        organizationId: effectiveOrgId,
        // Year-scope the assignment so cross-year assignments don't leak through.
        ...(activeYearId ? { yearId: activeYearId } : {}),
        OR: [
          { students: { some: { studentId: user.membershipId } } },
          ...(classIds.length > 0
            ? [{ classSectionId: { in: classIds } }]
            : []),
        ],
      };
      const whereStudent: Prisma.TestWhereInput = {
        deletedAt: null,
        organizationId: effectiveOrgId,
        status: PublishStatus.PUBLISHED,
        scheduledAssignments: { some: assignmentWhere },
        ...(activeYearId ? { academicYearId: activeYearId } : {}),
        ...(q.grade ? { allowedGrades: { has: q.grade } } : {}),
        ...(searchExpr(q.search) ?? {}),
      };
      const select = this.buildTestProjection(OrganizationRole.STUDENT, 'list');
      const [total, items] = await this.prisma.$transaction([
        this.prisma.test.count({ where: whereStudent }),
        this.prisma.test.findMany({
          where: whereStudent,
          select,
          skip,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      ]);
      return {
        items,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    const where: Prisma.TestWhereInput = {
      deletedAt: null,
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
      ...(q.grade ? { allowedGrades: { has: q.grade } } : {}),
      ...(searchExpr(q.search) ?? {}),
    };
    if (effectiveOrgId) {
      assertTenantWhere(where as Record<string, unknown>, effectiveOrgId);
    }
    const select = this.buildTestProjection(
      user.organizationRole ?? null,
      'list',
    );
    const scopeId = effectiveOrgId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'tests',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search ?? '',
      order: [{ createdAt: 'desc' }, { id: 'asc' }],
      filters: {
        status: q.status ?? null,
        organizationId: effectiveOrgId,
        subjectId: q.subjectId ?? null,
        academicYearId: q.academicYearId ?? null,
        grade: q.grade ?? null,
      },
    });

    const cached = await cacheGetOrSet(
      this.cache,
      cacheKey,
      600_000,
      async () => {
        const [total, items] = await this.prisma.$transaction([
          this.prisma.test.count({ where }),
          this.prisma.test.findMany({
            where,
            select,
            skip,
            take: limit,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
        ]);
        return {
          items,
          meta: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        };
      },
    );

    // Enrich items with fresh submission stats — outside the cache so metrics
    // always reflect the latest submissions (changes on every finish).
    const result = cached as { items: { id: string }[]; meta: unknown };
    if (result.items.length === 0) return cached;

    const stats = await this.computeTestStats(result.items.map((t) => t.id));
    return {
      ...result,
      items: result.items.map((t) => ({
        ...t,
        submissions: stats[t.id]?.submissions ?? 0,
        avgScore: stats[t.id]?.avgScore ?? null,
        completionRate: stats[t.id]?.completionRate ?? null,
      })),
    };
  }

  /**
   * IMPORTANT:
   * Always use findUnique when querying by primary key.
   * Using findFirst on PK can lead to nondeterministic results,
   * especially with soft-delete or multi-tenant scenarios.
   */
  async findOne(id: string, user: JwtPayload): Promise<unknown> {
    if (user.organizationId) {
      const scopedBaseWhere = withOrg(
        { id, deletedAt: null },
        user.organizationId,
      );
      assertTenantWhere(scopedBaseWhere, user.organizationId);
    }

    // Use findUnique (PK lookup) + explicit deletedAt guard instead of findFirst.
    const base = await this.prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        deletedAt: true,
        academicYearId: true,
      },
    });
    if (!base || base.deletedAt !== null) {
      throw new NotFoundException('Test nenalezen');
    }

    const assignability = await this.computeTestAssignability(id);

    if (user.systemRole === SystemRole.SUPERADMIN) {
      const teacherView = await this.prisma.test.findUnique({
        where: { id },
        select: this.buildTestProjection(OrganizationRole.DIRECTOR, 'detail'),
      });
      if (!teacherView) throw new NotFoundException('Test nenalezen');
      const editMode = await this.resolveEditModeForView(id, user);
      return this.mapTeacherView(teacherView, assignability, editMode);
    }

    if (!user.organizationId || user.organizationId !== base.organizationId) {
      throw new NotFoundException('Test nenalezen');
    }

    const member = user.membershipId
      ? await this.prisma.membership.findFirst({
          where: {
            id: user.membershipId,
            userId: user.userId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        })
      : await this.prisma.membership.findFirst({
          where: {
            userId: user.userId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
    if (!member) throw new ForbiddenException('Cizí organizace.');

    if (user.organizationRole === OrganizationRole.STUDENT) {
      if (base.status !== PublishStatus.PUBLISHED) {
        throw new NotFoundException('Test nenalezen');
      }
      await this.ensureStudentCanAccessTest(
        user,
        base.id,
        base.organizationId,
        base.academicYearId ?? null,
      );
      const studentView = await this.prisma.test.findUnique({
        where: { id },
        select: this.buildTestProjection(OrganizationRole.STUDENT, 'detail'),
      });
      if (!studentView) throw new NotFoundException('Test nenalezen');
      return this.mapStudentView(studentView);
    }

    const teacherView = await this.prisma.test.findUnique({
      where: { id },
      select: this.buildTestProjection(user.organizationRole ?? null, 'detail'),
    });
    if (!teacherView) throw new NotFoundException('Test nenalezen');
    const editMode = await this.resolveEditModeForView(id, user);
    return this.mapTeacherView(teacherView, assignability, editMode);
  }
  async update(
    id: string,
    dto: UpdateTestDto,
    user: JwtPayload,
  ): Promise<unknown> {
    if (user.organizationId) {
      const scopedWhere = withOrg({ id }, user.organizationId);
      assertTenantWhere(scopedWhere, user.organizationId);
    }
    const current = await this.prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        creatorId: true,
        deletedAt: true,
      },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Test nenalezen');

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId !== current.organizationId
    ) {
      throw new NotFoundException('Test nenalezen');
    }

    await this.ensureCanEditTest(user, current);

    const editMode = await this.resolveEditModeForView(id, user);
    if (
      editMode !== 'FULL' &&
      (dto.subjectId !== undefined || dto.allowedGrades !== undefined)
    ) {
      throw new ConflictException({
        code: 'TEST_STRUCTURE_LOCKED',
        message: 'Test has submissions. Question editing is locked.',
      });
    }

    if (dto.status === PublishStatus.PUBLISHED) {
      if (current.organizationId) {
        const readiness = await deriveOrgReadiness(
          this.prisma,
          current.organizationId,
        );
        if (!readiness.canExecute) {
          throw createOrgReadinessError({
            operationType: OrgOperationType.EXECUTION,
            state: readiness.state,
            missing: readiness.missing,
            requiredMinState: OrgReadinessState.R2_STRUCTURE_READY,
            messageOverride:
              'Organization must have a current year and at least one class section before publishing tests.',
          });
        }
      }

      // Verify subject is enabled for the organization and academic year is not soft-deleted.
      const testMeta = await this.prisma.test.findUnique({
        where: { id },
        select: {
          subjectId: true,
          organizationId: true,
          academicYear: { select: { deletedAt: true } },
        },
      });
      if (testMeta?.subjectId) {
        await this.validateSubject(testMeta.subjectId, testMeta.organizationId);
      } else {
        throw new BadRequestException({
          code: 'TEST_NOT_ASSIGNABLE',
          message: 'Test nemá platný školní předmět.',
          reasons: ['subject_not_enabled'],
        });
      }
      if (
        testMeta?.academicYear?.deletedAt !== null &&
        testMeta?.academicYear?.deletedAt !== undefined
      ) {
        throw new BadRequestException({
          code: 'TEST_NOT_ASSIGNABLE',
          message: 'Školní rok testu byl smazán. Aktualizujte přiřazení roku.',
          reasons: ['academic_year_deleted'],
        });
      }

      const report = await this.computeTestAssignability(id);
      this.throwIfNotAssignable(report);
    }

    const updateData: Prisma.TestUncheckedUpdateInput = {};
    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === PublishStatus.PUBLISHED) {
        updateData.publishedAt = new Date();
      }
    }
    if (dto.subjectId !== undefined) {
      await this.validateSubject(dto.subjectId, current.organizationId);
      updateData.subjectId = dto.subjectId;
    }

    if (dto.allowedGrades !== undefined) {
      const assignedGrades = await this.prisma.assignment.findMany({
        where: { testId: id },
        select: { classSection: { select: { grade: true } } },
        take: 1000, // safety cap — assignments of one test across years
      });
      const gradesInUse = [
        ...new Set(
          assignedGrades
            .map((a) => a.classSection?.grade)
            .filter((g): g is SchoolGrade => !!g),
        ),
      ];
      const missingAssignedGrades = gradesInUse.filter(
        (grade) => !(dto.allowedGrades ?? []).includes(grade),
      );
      if (missingAssignedGrades.length > 0) {
        throw new BadRequestException({
          code: 'TEST_ALLOWED_GRADES_CONFLICT',
          message: `Test je už přiřazen do ročníků ${missingAssignedGrades.join(', ')}, které by po úpravě vypadly z allowedGrades.`,
        });
      }
      updateData.allowedGrades = dto.allowedGrades;
    }

    let updated: unknown;

    if (dto.status === PublishStatus.PUBLISHED) {
      // Atomic publish: only transitions from DRAFT to PUBLISHED.
      // updateMany returns count=0 if test is already PUBLISHED (concurrent request).
      const publishResult = await this.prisma.test.updateMany({
        where: {
          id,
          organizationId: current.organizationId,
          status: PublishStatus.DRAFT,
        },
        data: updateData,
      });
      if (publishResult.count === 0) {
        throw new ConflictException({
          code: 'ALREADY_PUBLISHED',
          message:
            'Test je již publikován nebo byl mezitím upraven jiným požadavkem.',
        });
      }
      updated = await this.prisma.test.findUnique({
        where: { id },
        select: this.buildTestProjection(
          user.organizationRole ?? OrganizationRole.DIRECTOR,
          'detail',
        ),
      });
    } else {
      updated = await this.prisma.test.update({
        where: { id },
        data: updateData,
        select: this.buildTestProjection(
          user.organizationRole ?? OrganizationRole.DIRECTOR,
          'detail',
        ),
      });
    }

    await this.audit({
      userId: user.userId,
      orgId: current.organizationId ?? null,
      action: 'TEST_UPDATE',
      entityId: id,
      changedFields: dto as unknown as Record<string, unknown>,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return updated;
  }

  async remove(id: string, user: JwtPayload): Promise<unknown> {
    if (user.organizationId) {
      const scopedWhere = withOrg({ id }, user.organizationId);
      assertTenantWhere(scopedWhere, user.organizationId);
    }
    // Soft delete: testy tvoří auditní stopu (submissions/hodnocení).
    const current = await this.prisma.test.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        creatorId: true,
        deletedAt: true,
      },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Test nenalezen');

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId !== current.organizationId
    ) {
      throw new NotFoundException('Test nenalezen');
    }

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (
        user.organizationId !== current.organizationId ||
        !hasAtLeastRole(
          user.organizationRole ?? null,
          OrganizationRole.DIRECTOR,
        )
      ) {
        throw new ForbiddenException(
          'Mazat smí jen ředitel/owner nebo superadmin.',
        );
      }
    }

    const deleted = await this.prisma.test.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit({
      userId: user.userId,
      orgId: current.organizationId ?? null,
      action: 'TEST_DELETE_SOFT',
      entityId: id,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return deleted;
  }

  async assignTest(
    testId: string,
    dto: AssignTestDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        status: true,
        academicYearId: true,
        subjectId: true,
        allowedGrades: true,
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
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    // Tenancy FIRST: a cross-org caller must get an indistinguishable 404.
    // The publish/assignability checks below return rich diagnostics
    // (TEST_NOT_PUBLISHED, TEST_NOT_ASSIGNABLE + reasons) that would
    // otherwise leak the existence and state of another org's test.
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== test.organizationId) {
        throw new NotFoundException('Test nenalezen');
      }
    }

    const organizationId = test.organizationId;

    if (dto.organizationId && dto.organizationId !== organizationId) {
      throw new ForbiddenException('Invalid org scope for test assignment');
    }

    // Class-section tenancy before state checks: a foreign class must be an
    // indistinguishable 404, never a diagnostic about the test's state.
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true, yearId: true, grade: true },
    });
    if (!classSection || classSection.orgId !== organizationId) {
      throw new NotFoundException('Class section nenalezena');
    }

    if (test.status !== PublishStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'TEST_NOT_PUBLISHED',
        message: 'Test musí být publikován před přiřazením.',
      });
    }

    const report = await this.computeTestAssignability(test.id);
    this.logger.debug(
      `[assignTest] testId=${testId} status=${test.status} ` +
        `isAssignable=${report.isAssignable} ` +
        `topicAssignments=${report.reasons.noTopicAssignments === 0 ? 'ok' : 'missing'} ` +
        `selectedTopicLevelId=${dto.topicLevelId ?? 'none'} ` +
        `issues=[${report.issues.map((i) => i.reason).join(',')}]`,
    );
    this.throwIfNotAssignable(report);

    if (test.academicYearId && test.academicYearId !== classSection.yearId) {
      throw new BadRequestException({
        code: 'YEAR_MISMATCH',
        message: 'Test patří do jiného školního roku než třída.',
      });
    }

    if (!test.allowedGrades.includes(classSection.grade)) {
      throw new BadRequestException({
        code: 'TEST_NOT_ALLOWED_FOR_GRADE',
        message: 'Test není určen pro daný ročník.',
      });
    }

    let topicLevelId: string | null = null;
    if (dto.topicLevelId) {
      const topicLevel = await this.prisma.topicLevel.findUnique({
        where: { id: dto.topicLevelId },
        select: {
          id: true,
          subjectLevel: {
            select: {
              subjectId: true,
            },
          },
        },
      });
      if (!topicLevel) {
        throw new NotFoundException('Téma nebylo nalezeno.');
      }
      if (topicLevel.subjectLevel.subjectId !== test.subjectId) {
        throw new BadRequestException({
          code: 'TOPIC_NOT_IN_TEST_SUBJECT',
          message: 'Vybrané téma nepatří do předmětu tohoto testu.',
        });
      }
      topicLevelId = topicLevel.id;
    } else {
      this.logger.warn(
        `Assigning test ${testId} without topicLevelId; diagnostic results will fall back to "${'Bez tématu'}".`,
      );
    }

    // Validate time window: openAt must be strictly before closeAt.
    const openAtDate = new Date(dto.openAt);
    const closeAtDate = new Date(dto.closeAt);
    if (isNaN(openAtDate.getTime()) || isNaN(closeAtDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_TIME_WINDOW',
        message: 'Datum otevření nebo uzavření testu je neplatné.',
      });
    }
    if (openAtDate >= closeAtDate) {
      throw new BadRequestException({
        code: 'INVALID_TIME_WINDOW',
        message: 'Datum otevření testu musí být před datem uzavření.',
      });
    }

    const creatorMembership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId,
        role: {
          in: [
            OrganizationRole.TEACHER,
            OrganizationRole.DIRECTOR,
            OrganizationRole.OWNER,
          ],
        },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!creatorMembership) {
      throw new ForbiddenException('Nemáš oprávnění přiřadit test');
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        organizationId,
        yearId: classSection.yearId,
        testId: testId,
        targetType: 'CLASS',
        classSectionId: dto.classSectionId,
        topicLevelId,
        openAt: new Date(dto.openAt),
        closeAt: new Date(dto.closeAt),
        maxAttempts: dto.maxAttempts,
        timeLimitSec: dto.timeLimitSec ?? null,
        shuffle: dto.shuffle,
        showExplain: dto.showExplain,
        createdById: creatorMembership.id,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: user.organizationId ?? null,
      action: 'TEST_ASSIGN',
      entityId: assignment.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });

    return assignment;
  }

  async results(
    testId: string,
    user: JwtPayload,
    paging?: { page?: number; limit?: number },
  ): Promise<unknown> {
    const page = Math.max(1, paging?.page ?? 1);
    const limit = Math.min(100, Math.max(1, paging?.limit ?? 20));
    const skip = (page - 1) * limit;

    const testWhere: Prisma.TestWhereInput = withOrg(
      { id: testId, deletedAt: null },
      user.organizationId ?? '',
    );
    if (user.organizationId) {
      assertTenantWhere(
        testWhere as Record<string, unknown>,
        user.organizationId,
      );
    }

    const test = await this.prisma.test.findFirst({
      where: user.organizationId ? testWhere : { id: testId, deletedAt: null },
      select: { id: true, organizationId: true, academicYearId: true },
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== test.organizationId) {
        throw new NotFoundException('Test nenalezen');
      }
    }

    const membership = await this.resolveOrgMembership(
      user,
      test.organizationId,
    );
    const role = membership?.role ?? user.organizationRole ?? null;

    let assignmentScope: Prisma.AssignmentWhereInput | undefined;
    if (role === OrganizationRole.TEACHER && membership) {
      const yearId = test.academicYearId;
      const allowedClassIds = yearId
        ? await this.resolveTeacherAllowedClassSectionIds(
            membership.id,
            test.organizationId,
            yearId,
          )
        : [];
      // Filter submissions to only those in the teacher's allowed classes.
      // If allowedClassIds is empty, use an impossible value so zero rows return.
      assignmentScope = {
        organizationId: test.organizationId,
        classSectionId:
          allowedClassIds.length > 0
            ? { in: allowedClassIds }
            : { in: ['__none__'] },
      };
    }

    const submissionsWhere: Prisma.SubmissionWhereInput = {
      testId,
      assignment: assignmentScope ?? { organizationId: test.organizationId },
      deletedAt: null,
      ...(role === OrganizationRole.STUDENT && membership
        ? { studentId: membership.id }
        : {}),
    };

    const [total, submissions] = await this.prisma.$transaction([
      this.prisma.submission.count({ where: submissionsWhere }),
      this.prisma.submission.findMany({
        where: submissionsWhere,
        include: {
          assignment: { select: { id: true, classSectionId: true } },
          responses: {
            select: { isCorrect: true },
          },
          student: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: submissions.map((s) => {
        const correctCount = s.responses.filter(
          (r) => r.isCorrect === true,
        ).length;
        const incorrectCount = s.responses.filter(
          (r) => r.isCorrect === false,
        ).length;
        const pendingCount = s.responses.filter(
          (r) => r.isCorrect == null,
        ).length;
        const totalEvaluated = correctCount + incorrectCount;
        return {
          id: s.id,
          score: s.earnedPoints,
          maxPoints: s.maxPoints,
          percentage:
            s.earnedPoints != null && s.maxPoints != null && s.maxPoints > 0
              ? Math.round((s.earnedPoints / s.maxPoints) * 10000) / 100
              : null,
          status: s.status,
          submittedAt: s.submittedAt,
          attemptNo: s.attemptNo,
          assignmentId: s.assignmentId,
          classSectionId: s.assignment?.classSectionId ?? null,
          correctCount,
          incorrectCount,
          pendingCount,
          totalEvaluated,
          student:
            role === OrganizationRole.STUDENT
              ? null
              : { name: s.student?.user?.name ?? null },
          isAnonymous: s.isAnonymous ?? false,
        };
      }),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Teacher/Director: per-student answer breakdown for a test.
   * GET /tests/:id/results/:studentId
   * Returns the most recent submitted submission with per-answer snapshot data.
   * Fully tenant-safe: both the test and the submission are pinned to ctx.organizationId.
   */
  async getStudentResult(
    testId: string,
    studentId: string,
    user: JwtPayload,
    ctx: OrgContext,
  ): Promise<unknown> {
    const orgId = ctx.organizationId;

    const test = await this.prisma.test.findUnique({
      where: { id: testId, deletedAt: null },
      select: { id: true, organizationId: true, academicYearId: true },
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    // Explicit tenant guard: test must belong to the caller's org.
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (test.organizationId !== orgId) {
        throw new ForbiddenException('Cizí organizace.');
      }
    }

    const membership = await this.resolveOrgMembership(
      user,
      test.organizationId,
    );
    const role = membership?.role ?? user.organizationRole ?? null;
    if (role === OrganizationRole.STUDENT) {
      throw new ForbiddenException('Přístup pouze pro učitele a ředitele.');
    }

    // CLASS-SCOPE GUARD: TEACHER sees only students in classes they teach
    // (homeroom OR explicitly assigned via TeacherClassSection).
    // DIRECTOR and SUPERADMIN bypass this guard entirely.
    if (role === OrganizationRole.TEACHER && membership) {
      if (!test.academicYearId) {
        throw new ForbiddenException({
          code: 'NOT_YOUR_CLASS',
          message: 'Test není přiřazen ke školnímu roku.',
        });
      }
      const allowedClassIds = await this.resolveTeacherAllowedClassSectionIds(
        membership.id,
        orgId,
        test.academicYearId,
      );
      if (allowedClassIds.length === 0) {
        throw new ForbiddenException({
          code: 'NOT_YOUR_CLASS',
          message: 'Nejsi přiřazen k žádné třídě.',
        });
      }

      // Resolve student's actual Student record (Submission.studentId = Membership.id).
      const studentRecord = await this.prisma.student.findFirst({
        where: { membershipId: studentId, orgId },
        select: { id: true },
      });
      const enrollment = studentRecord
        ? await this.prisma.enrollment.findFirst({
            where: {
              studentId: studentRecord.id,
              yearId: test.academicYearId,
              orgId,
            },
            select: { classSectionId: true },
          })
        : null;

      if (!enrollment || !allowedClassIds.includes(enrollment.classSectionId)) {
        throw new ForbiddenException({
          code: 'NOT_YOUR_CLASS',
          message: 'Student není ve třídě, kterou učíš.',
        });
      }
    }

    // Find the most recent submitted submission, strictly scoped to the caller's org.
    const submission = await this.prisma.submission.findFirst({
      where: {
        testId,
        studentId,
        organizationId: orgId, // explicit org scope — not trusting test.organizationId alone
        submittedAt: { not: null },
        deletedAt: null,
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        student: {
          select: { organizationId: true, user: { select: { name: true } } },
        },
        responses: {
          select: {
            id: true,
            questionId: true,
            givenText: true,
            isCorrect: true,
            awardedPoints: true,
            maxPoints: true,
            correctAnswerSnapshot: true,
            questionTextSnapshot: true,
            explanation: true,
            question: { select: { text: true, type: true, score: true } },
          },
        },
      },
    });

    if (!submission) throw new NotFoundException('Submission nenalezena');

    // Belt-and-suspenders: the student membership must also belong to the same org.
    if (submission.student.organizationId !== orgId) {
      throw new ForbiddenException('Cizí organizace.');
    }

    const totalPoints = submission.responses.reduce(
      (sum, r) => sum + (r.awardedPoints ?? 0),
      0,
    );
    const maxTotalPoints = submission.responses.reduce(
      (sum, r) => sum + (r.maxPoints ?? r.question?.score ?? 1),
      0,
    );
    // Returns null (not 0) when there are no scoreable questions — frontend shows "—".
    const percentage = maxTotalPoints > 0 ? totalPoints / maxTotalPoints : null;

    return {
      submissionId: submission.id,
      studentName: submission.student?.user?.name ?? null,
      submittedAt: submission.submittedAt,
      totalPoints,
      maxTotalPoints,
      percentage,
      answers: submission.responses.map((r) => ({
        questionId: r.questionId,
        // Snapshot fields — immutable, taken at submit time.
        questionTextSnapshot:
          r.questionTextSnapshot ?? r.question?.text ?? null,
        givenText: r.givenText,
        isCorrect: r.isCorrect,
        correctAnswerSnapshot: r.correctAnswerSnapshot,
        awardedPoints: r.awardedPoints,
        maxPoints: r.maxPoints ?? r.question?.score ?? null,
        explanationSnapshot: r.explanation,
      })),
    };
  }

  // ====== QUESTIONS / OPTIONS / ANSWERS ===========================
  private async getEditableTestFor(user: JwtPayload, testId: string) {
    const t = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        organizationId: true,
        creatorId: true,
        deletedAt: true,
      },
    });
    if (!t || t.deletedAt) throw new NotFoundException('Test nenalezen');
    await this.ensureCanEditTest(user, t);
    return t;
  }

  // Questions
  async addQuestion(
    testId: string,
    dto: CreateQuestionDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);

    // Scope mismatch guard: test's org must match the calling user's org.
    // Use the DB-verified organizationId from the test, never trust the
    // raw DTO or ctx directly without this validation.
    if (user.organizationId && t.organizationId !== user.organizationId) {
      throw new ForbiddenException('Scope mismatch');
    }

    const answers = this.buildAnswerFields({
      type: dto.type,
      correctAnswer: dto.correctAnswer,
      correctAnswers: dto.correctAnswers,
    });
    const q = await this.prisma.question.create({
      data: {
        testId: t.id,
        text: dto.text,
        type: dto.type,
        order: dto.order ?? 0,
        score: dto.score ?? 1,
        correctAnswer: answers.correctAnswer ?? null,
        correctAnswers: answers.correctAnswers ?? [],
      },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'QUESTION_CREATE',
      entityId: q.id,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return q;
  }

  async updateQuestion(
    testId: string,
    questionId: string,
    dto: UpdateQuestionDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.question.findFirst({
      where: { id: questionId, testId },
      select: {
        id: true,
        type: true,
        correctAnswer: true,
        correctAnswers: true,
      },
    });
    if (!exists) throw new NotFoundException('Otázka nenalezena');
    const nextType = dto.type ?? exists.type;
    const answers = this.buildAnswerFields({
      type: nextType,
      correctAnswer: dto.correctAnswer,
      correctAnswers: dto.correctAnswers,
      existing: {
        correctAnswer: exists.correctAnswer,
        correctAnswers: exists.correctAnswers,
      },
    });
    const questionUpdate: Prisma.QuestionUncheckedUpdateInput = {};
    if (dto.text !== undefined) {
      questionUpdate.text = dto.text;
    }
    if (dto.type !== undefined) {
      questionUpdate.type = dto.type;
    }
    if (dto.order !== undefined) {
      questionUpdate.order = dto.order;
    }
    if (dto.score !== undefined) {
      questionUpdate.score = dto.score;
    }
    if (answers.correctAnswer !== undefined) {
      questionUpdate.correctAnswer = answers.correctAnswer;
    }
    if (answers.correctAnswers !== undefined) {
      questionUpdate.correctAnswers = answers.correctAnswers;
    }
    const q = await this.prisma.question.update({
      where: { id: questionId },
      data: questionUpdate,
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'QUESTION_UPDATE',
      entityId: q.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return q;
  }

  async reorderQuestions(
    testId: string,
    dto: ReorderQuestionsDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);

    // ověř, že všechny otázky patří do testu
    const ids = dto.items.map((i) => i.id);
    const count = await this.prisma.question.count({
      where: { id: { in: ids }, testId },
    });
    if (count !== ids.length)
      throw new BadRequestException('Některé otázky nepatří do testu.');

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.question.update({
          where: { id: i.id },
          data: { order: i.order },
        }),
      ),
    );

    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'QUESTION_REORDER',
      changedFields: dto as unknown as Record<string, unknown>,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return { ok: true };
  }

  async removeQuestion(
    testId: string,
    questionId: string,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.question.findFirst({
      where: { id: questionId, testId },
    });
    if (!exists) throw new NotFoundException('Otázka nenalezena');
    await this.prisma.question.delete({ where: { id: questionId } });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'QUESTION_DELETE',
      entityId: questionId,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return { id: questionId, deleted: true };
  }

  // Options
  async addOption(
    testId: string,
    questionId: string,
    dto: CreateOptionDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, testId },
    });
    if (!q) throw new NotFoundException('Otázka nenalezena');
    const o = await this.prisma.option.create({
      data: { questionId, text: dto.text },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'OPTION_CREATE',
      entityId: o.id,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return o;
  }

  async updateOption(
    testId: string,
    questionId: string,
    optionId: string,
    dto: UpdateOptionDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.option.findFirst({
      where: { id: optionId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Možnost nenalezena');
    const optionUpdate: Prisma.OptionUncheckedUpdateInput = {};
    if (dto.text !== undefined) {
      optionUpdate.text = dto.text;
    }
    const o = await this.prisma.option.update({
      where: { id: optionId },
      data: optionUpdate,
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'OPTION_UPDATE',
      entityId: o.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return o;
  }

  async removeOption(
    testId: string,
    questionId: string,
    optionId: string,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.option.findFirst({
      where: { id: optionId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Možnost nenalezena');
    await this.prisma.option.delete({ where: { id: optionId } });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'OPTION_DELETE',
      entityId: optionId,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return { id: optionId, deleted: true };
  }

  // Answers
  async addAnswer(
    testId: string,
    questionId: string,
    dto: CreateAnswerDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, testId },
    });
    if (!q) throw new NotFoundException('Otázka nenalezena');
    const a = await this.prisma.answer.create({
      data: { questionId, text: dto.text },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'ANSWER_CREATE',
      entityId: a.id,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return a;
  }

  async updateAnswer(
    testId: string,
    questionId: string,
    answerId: string,
    dto: UpdateAnswerDto,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.answer.findFirst({
      where: { id: answerId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Odpověď nenalezena');
    const answerUpdate: Prisma.AnswerUncheckedUpdateInput = {};
    if (dto.text !== undefined) {
      answerUpdate.text = dto.text;
    }
    const a = await this.prisma.answer.update({
      where: { id: answerId },
      data: answerUpdate,
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'ANSWER_UPDATE',
      entityId: a.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return a;
  }

  async removeAnswer(
    testId: string,
    questionId: string,
    answerId: string,
    user: JwtPayload,
  ): Promise<unknown> {
    const t = await this.getEditableTestFor(user, testId);
    await this.ensureQuestionMutationsAllowed(testId);
    const exists = await this.prisma.answer.findFirst({
      where: { id: answerId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Odpověď nenalezena');
    await this.prisma.answer.delete({ where: { id: answerId } });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'ANSWER_DELETE',
      entityId: answerId,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return { id: answerId, deleted: true };
  }
}
