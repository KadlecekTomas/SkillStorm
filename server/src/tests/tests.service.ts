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
import type { TeacherTestViewDTO } from './dto/teacher-test-view.dto';
import type { StudentTestViewDTO } from './dto/student-test-view.dto';
import { assertTenantWhere, withOrg } from '@/common/prisma/tenant-scope';
import type { OrgContext } from '@/common/org-context/org-context.types';


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

  private testListSelect() {
    return Prisma.validator<Prisma.TestSelect>()({
      id: true,
      organizationId: true,
      title: true,
      description: true,
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
    });
  }

  private studentDetailSelect() {
    return Prisma.validator<Prisma.TestSelect>()({
      id: true,
      organizationId: true,
      title: true,
      description: true,
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
  ): TeacherTestViewDTO {
    return {
      ...(test as Record<string, unknown>),
      assignability,
    } as TeacherTestViewDTO;
  }

  private mapStudentView(test: unknown): StudentTestViewDTO {
    return test as StudentTestViewDTO;
  }

  private async ensureStudentCanAccessTest(
    user: JwtPayload,
    testId: string,
    organizationId: string,
  ): Promise<void> {
    if (
      user.organizationRole !== OrganizationRole.STUDENT ||
      !user.membershipId
    ) {
      return;
    }

    const now = new Date();
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

    const activeClassIds = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: { not: EnrollmentStatus.LEFT },
      },
      select: { classSectionId: true },
    });
    const classIds = activeClassIds.map((x) => x.classSectionId);

    const openAssignment = await this.prisma.assignment.findFirst({
      where: {
        organizationId,
        testId,
        openAt: { lte: now },
        closeAt: { gte: now },
        OR: [
          { students: { some: { studentId: user.membershipId } } },
          ...(classIds.length > 0
            ? [{ classSectionId: { in: classIds } }]
            : []),
        ],
      },
      select: { id: true },
    });

    if (openAssignment) return;

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

  /** Validate that subjectId belongs to the org, has not been soft-deleted, and is active. */
  private async validateSubject(
    subjectId: string,
    organizationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const subject = await db.subject.findFirst({
      where: { id: subjectId, organizationId, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!subject) {
      throw new BadRequestException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Předmět neexistuje nebo byl smazán.',
      });
    }
    if (!subject.isActive) {
      throw new BadRequestException({
        code: 'SUBJECT_INACTIVE',
        message: 'Předmět je deaktivován. Aktivujte jej před vytvořením testu.',
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
        where: { id: academicYearId, orgId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!year) {
        throw new BadRequestException({
          code: 'INVALID_ACADEMIC_YEAR',
          message: 'Školní rok neexistuje, nepatří do organizace, nebo byl smazán.',
        });
      }
      return year.id;
    }

    // Fallback: ctx.activeAcademicYearId comes from a short-lived cache —
    // verify the year still exists in the DB and has not been soft-deleted.
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ACADEMIC_YEAR',
        message: 'Není aktivní školní rok. Požádejte ředitele o nastavení aktívního roku.',
      });
    }
    const fallbackYear = await db.academicYear.findFirst({
      where: { id: ctx.activeAcademicYearId, orgId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!fallbackYear) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ACADEMIC_YEAR',
        message: 'Aktivní školní rok byl smazán nebo je neplatný. Požádejte ředitele o aktualizaci.',
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
    const questions = await this.prisma.question.findMany({
      where: { testId },
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
    });
    return computeAssignability(questions);
  }

  private throwIfNotAssignable(report: AssignabilityReport): void {
    if (!report.isAssignable) {
      throw new ConflictException({
        errorCode: 'TEST_NOT_ASSIGNABLE',
        code: 'TEST_NOT_ASSIGNABLE',
        message: 'Test is not assignable',
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
      const yearId = await this.resolveAcademicYear(ctx, dto.academicYearId, tx);

      return tx.test.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          organizationId: orgId,
          subjectId: dto.subjectId,
          academicYearId: yearId,
          status: dto.status ?? PublishStatus.DRAFT,
          creatorId: author.id,
        },
        select: this.buildTestProjection(
          user.organizationRole ?? OrganizationRole.DIRECTOR,
          'detail',
        ),
      });
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TEST_CREATE',
      entityId: created.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, orgId),
    );
    return created;
  }

  async findAll(user: JwtPayload, q: QueryTestsDto): Promise<unknown> {
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
      const now = new Date();
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
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          studentId: student.id,
          status: { not: EnrollmentStatus.LEFT },
        },
        select: { classSectionId: true },
      });
      const classIds = enrollments.map((e) => e.classSectionId);
      const assignmentWhere: Prisma.AssignmentWhereInput = {
        organizationId: effectiveOrgId,
        openAt: { lte: now },
        closeAt: { gte: now },
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
        ...(q.status ? { status: q.status } : {}),
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
      },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
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
    });
  }

  /**
   * IMPORTANT:
   * Always use findUnique when querying by primary key.
   * Using findFirst on PK can lead to nondeterministic results,
   * especially with soft-delete or multi-tenant scenarios.
   */
  async findOne(id: string, user: JwtPayload): Promise<unknown> {
    // eslint-disable-next-line no-console
    console.log('FINDONE ENTRY testId=', id, 'role=', user.organizationRole ?? 'null');
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
      select: { id: true, organizationId: true, status: true, deletedAt: true },
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
      return this.mapTeacherView(teacherView, assignability);
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
      await this.ensureStudentCanAccessTest(user, base.id, base.organizationId);
      const studentView = await this.prisma.test.findUnique({
        where: { id },
        select: this.buildTestProjection(OrganizationRole.STUDENT, 'detail'),
      });
      if (!studentView) throw new NotFoundException('Test nenalezen');
      return this.mapStudentView(studentView);
    }

    // PHASE 1: raw count via direct query — bypasses Prisma relation resolution entirely.
    // If rawCount > 0 but questions.length = 0 → problem is in relation select, not data.
    // If rawCount = 0 → insert used a different testId than this GET.
    const rawCount = await this.prisma.question.count({
      where: { testId: id },
    });
    // eslint-disable-next-line no-console
    console.log('RAW QUESTION COUNT (DIRECT QUERY)', rawCount);
    // PHASE RAW-SQL: bypass ORM entirely — check DB state with raw SQL.
    const rawSql = await this.prisma.$queryRaw<{ qid: string; tid: string }[]>`
      SELECT question_id AS qid, test_id AS tid FROM questions WHERE test_id = ${id}
    `;
    // eslint-disable-next-line no-console
    console.log('RAW SQL QUESTIONS', rawSql.length, rawSql.map((r) => r.qid));

    // PHASE 7: absolute isolation — include instead of select, bypasses buildTestProjection.
    // Uncomment this block and comment out the teacherView below to test.
    // const teacherView = await this.prisma.test.findUnique({
    //   where: { id },
    //   include: { questions: true },
    // });

    const teacherView = await this.prisma.test.findUnique({
      where: { id },
      select: this.buildTestProjection(user.organizationRole ?? null, 'detail'),
    });
    if (!teacherView) throw new NotFoundException('Test nenalezen');
    // eslint-disable-next-line no-console
    console.log('VERIFY FIND UNIQUE TEST ID', teacherView.id);
    // eslint-disable-next-line no-console
    console.log('FINDONE QUESTIONS COUNT', teacherView.questions?.length ?? 0);
    const findOneTrace = `[TRACE][findOne] testId=${id} orgId=${base.organizationId} role=${String(
      user.organizationRole ?? 'null',
    )} questions=${teacherView.questions?.length ?? 0}`;
    this.logger.log(findOneTrace);
    // Temporary trace for debugging flow visibility in tests/local runs.
    // eslint-disable-next-line no-console
    console.log(findOneTrace);
    return this.mapTeacherView(teacherView, assignability);
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
    }
    if (dto.subjectId !== undefined) {
      await this.validateSubject(dto.subjectId, current.organizationId);
      updateData.subjectId = dto.subjectId;
    }

    const updated = await this.prisma.test.update({
      where: { id },
      data: updateData,
      select: this.buildTestProjection(
        user.organizationRole ?? OrganizationRole.DIRECTOR,
        'detail',
      ),
    });

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

    const report = await this.computeTestAssignability(test.id);
    this.throwIfNotAssignable(report);

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== test.organizationId) {
        throw new NotFoundException('Test nenalezen');
      }
    }

    const organizationId = test.organizationId;

    if (dto.organizationId && dto.organizationId !== organizationId) {
      throw new ForbiddenException('Invalid org scope for test assignment');
    }

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true, yearId: true, grade: true },
    });
    if (!classSection || classSection.orgId !== organizationId) {
      throw new NotFoundException('Class section nenalezena');
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
        topicLevelId: null,
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
      select: { id: true, organizationId: true },
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
      const teacher = await this.prisma.teacher.findFirst({
        where: { membershipId: membership.id, deletedAt: null },
        select: { id: true },
      });
      assignmentScope = {
        organizationId: test.organizationId,
        OR: [
          { createdById: membership.id },
          ...(teacher ? [{ classSection: { teacherId: teacher.id } }] : []),
        ],
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
      items: submissions.map((s) => ({
        id: s.id,
        score: s.score,
        submittedAt: s.submittedAt,
        attemptNo: s.attemptNo,
        assignmentId: s.assignmentId,
        classSectionId: s.assignment?.classSectionId ?? null,
        student:
          role === OrganizationRole.STUDENT
            ? null
            : { name: s.student?.user?.name ?? null },
        isAnonymous: s.isAnonymous ?? false,
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // ====== TEMPORARY DEBUG — remove before release ====================
  /**
   * [TEMP DEBUG] Full visibility trace for a given student.
   * Returns structured JSON explaining why each assignment is or isn't visible.
   * DO NOT ship to production — no pagination, no rate-limit, scans all org assignments.
   */
  async debugStudentVisibility(
    membershipId: string,
    organizationId: string,
  ): Promise<unknown> {
    const now = new Date();
    // eslint-disable-next-line no-console
    console.log('[DEBUG] debugStudentVisibility', { membershipId, organizationId, now: now.toISOString() });

    // 1. Current academic year for this org
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { orgId: organizationId, isCurrent: true },
      select: { id: true, label: true, startsAt: true, endsAt: true },
    });
    // eslint-disable-next-line no-console
    console.log('[DEBUG] currentAcademicYear', currentYear);

    // 2. Student record (via membershipId)
    const student = await this.prisma.student.findFirst({
      where: { membershipId, orgId: organizationId, deletedAt: null },
      select: { id: true, membershipId: true, orgId: true, studentNumber: true },
    });
    // eslint-disable-next-line no-console
    console.log('[DEBUG] student', student);

    // 3. ALL enrollments for this student (all statuses — full debug)
    const enrollments = student
      ? await this.prisma.enrollment.findMany({
          where: { studentId: student.id, orgId: organizationId },
          select: {
            id: true,
            classSectionId: true,
            yearId: true,
            status: true,
          },
        })
      : [];
    const classSectionIds = enrollments.map((e) => e.classSectionId);
    // eslint-disable-next-line no-console
    console.log('[DEBUG] enrollments', enrollments);
    // eslint-disable-next-line no-console
    console.log('[DEBUG] classSectionIds', classSectionIds);

    // 4. ALL assignments in this org — no pre-filter, we analyse every one
    const assignments = await this.prisma.assignment.findMany({
      where: { organizationId },
      select: {
        id: true,
        testId: true,
        targetType: true,
        classSectionId: true,
        yearId: true,
        openAt: true,
        closeAt: true,
        maxAttempts: true,
        students: { select: { studentId: true } },
      },
    });
    // eslint-disable-next-line no-console
    console.log('[DEBUG] totalAssignmentsInOrg', assignments.length);

    // 5. Per-assignment visibility computation
    const assignmentAnalysis = await Promise.all(
      assignments.map(async (a) => {
        // Targeting check
        const isTargetedByClass =
          a.targetType === 'CLASS' &&
          a.classSectionId !== null &&
          classSectionIds.includes(a.classSectionId as string);

        const isTargetedByStudent =
          a.targetType === 'STUDENTS' &&
          a.students.some((s) => s.studentId === membershipId);

        const isTargetedToStudent = isTargetedByClass || isTargetedByStudent;

        // Time window check
        const isWithinTimeWindow = a.openAt <= now && a.closeAt >= now;

        // Submission / attempt check
        const submissions = await this.prisma.submission.findMany({
          where: {
            assignmentId: a.id,
            studentId: membershipId,
            deletedAt: null,
          },
          select: { id: true, attemptNo: true },
        });
        const attemptsUsed = submissions.length;
        const hasSubmission = attemptsUsed > 0;
        const remainingAttempts = a.maxAttempts - attemptsUsed;

        // Final visibility
        const visible =
          isTargetedToStudent && isWithinTimeWindow && remainingAttempts > 0;

        // Human-readable reasons for being hidden
        const hiddenReasons: string[] = [];
        if (!isTargetedToStudent) {
          hiddenReasons.push(
            `not_targeted (targetType=${a.targetType}, assignmentClassSection=${String(a.classSectionId)}, studentSections=${JSON.stringify(classSectionIds)})`,
          );
        }
        if (!isWithinTimeWindow) {
          if (a.openAt > now) {
            hiddenReasons.push(`not_open_yet (opens=${a.openAt.toISOString()})`);
          } else {
            hiddenReasons.push(`already_closed (closedAt=${a.closeAt.toISOString()})`);
          }
        }
        if (remainingAttempts <= 0) {
          hiddenReasons.push(`no_remaining_attempts (used=${attemptsUsed}, max=${a.maxAttempts})`);
        }

        // eslint-disable-next-line no-console
        console.log('[DEBUG] assignment', a.id, {
          visible,
          isTargetedToStudent,
          isTargetedByClass,
          isTargetedByStudent,
          isWithinTimeWindow,
          attemptsUsed,
          remainingAttempts,
          hiddenReasons,
        });

        return {
          id: a.id,
          testId: a.testId,
          targetType: a.targetType,
          classSectionId: a.classSectionId,
          yearId: a.yearId,
          openAt: a.openAt,
          closeAt: a.closeAt,
          maxAttempts: a.maxAttempts,
          isTargetedByClass,
          isTargetedByStudent,
          isTargetedToStudent,
          isWithinTimeWindow,
          hasSubmission,
          attemptsUsed,
          remainingAttempts,
          visible,
          hiddenReasons,
        };
      }),
    );

    const result = {
      now: now.toISOString(),
      student: student ?? null,
      currentAcademicYear: currentYear ?? null,
      enrollments,
      classSectionIds,
      assignments: assignmentAnalysis,
      summary: {
        totalAssignments: assignments.length,
        visibleToStudent: assignmentAnalysis.filter((a) => a.visible).length,
        hiddenAssignments: assignmentAnalysis.filter((a) => !a.visible).length,
      },
    };

    // eslint-disable-next-line no-console
    console.log('[DEBUG] debugStudentVisibility SUMMARY', result.summary);
    return result;
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
    // Temporary end-to-end trace for addQuestion diagnostics.
    // eslint-disable-next-line no-console
    console.log('ADD QUESTION CALLED', { testId, dto });
    const t = await this.getEditableTestFor(user, testId);

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
    // eslint-disable-next-line no-console
    console.log('QUESTION CREATED WITH SCOPE', {
      id: q.id,
      testId: q.testId,
      org: t.organizationId,
      paramTestId: testId,
      resolvedTestId: t.id,
    });
    const testQuestionCount = await this.prisma.question.count({
      where: { testId: t.id },
    });
    // eslint-disable-next-line no-console
    console.log('COUNT AFTER INSERT', testQuestionCount);
    const addQuestionTrace = `[TRACE][addQuestion] testId=${testId} createdQuestionId=${q.id} createdOrder=${String(
      q.order,
    )} countAfterInsert=${testQuestionCount}`;
    this.logger.log(addQuestionTrace);
    // Temporary trace for debugging flow visibility in tests/local runs.
    // eslint-disable-next-line no-console
    console.log(addQuestionTrace);
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
