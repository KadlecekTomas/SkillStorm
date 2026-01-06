// src/tests/tests.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
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

import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';

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
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private includeAll() {
    return Prisma.validator<Prisma.TestInclude>()({
      organization: true,
      creator: { include: { user: true, organization: true } },
      questions: {
        include: { options: true, answers: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }], // => bez createdAt (není ve schématu)
      },
    });
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

  private async resolveOrgMembership(
    user: JwtPayload,
    organizationId: string,
  ) {
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

    const isDirector = user.organizationRole === OrganizationRole.DIRECTOR;
    if (isDirector) return;

    const isAuthor = await this.prisma.membership.findFirst({
      where: { id: test.creatorId, userId: user.userId, deletedAt: null },
      select: { id: true },
    });
    if (!isAuthor)
      throw new ForbiddenException('Upravovat může jen autor nebo ředitel.');
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
        correctAnswer:
          hasAnswerInput ? normalizedAnswer : existing?.correctAnswer ?? null,
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
      correctAnswer:
        hasAnswerInput ? normalizedAnswer : existing?.correctAnswer ?? null,
      correctAnswers: existing?.correctAnswers ?? [],
    };
  }

  private isQuestionScoreable(q: {
    type: string;
    correctAnswer: string | null;
    correctAnswers: string[];
  }) {
    const hasAnswer = this.normalizeText(q.correctAnswer) !== null;
    const hasAnswers = Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0;

    if (q.type === 'MULTIPLE_CHOICE') {
      if (hasAnswer && hasAnswers) return false;
      return hasAnswer || hasAnswers;
    }
    if (q.type === 'TRUE_FALSE' || q.type === 'FILL_IN_THE_BLANK') {
      return hasAnswer;
    }
    return false;
  }

  private async ensureTestScoreable(testId: string) {
    const questions = await this.prisma.question.findMany({
      where: { testId },
      select: {
        id: true,
        type: true,
        correctAnswer: true,
        correctAnswers: true,
      },
    });
    if (questions.length === 0) {
      throw new BadRequestException('Test has no questions');
    }
    const unscorable = questions.filter((q) => !this.isQuestionScoreable(q));
    if (unscorable.length > 0) {
      throw new BadRequestException({
        message: 'Test contains unscorable questions',
        questionIds: unscorable.map((q) => q.id),
      });
    }
  }

  // ====== TESTS ===================================================
  async create(dto: CreateTestDto, user: JwtPayload): Promise<unknown> {
    const isSuper = user.systemRole === SystemRole.SUPERADMIN;

    if (!isSuper) {
      if (!user.organizationId || user.organizationId !== dto.organizationId) {
        throw new ForbiddenException(
          'Test lze vytvořit jen ve své organizaci.',
        );
      }
    }

    let author = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: dto.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!author) {
      if (isSuper) {
        author = await this.prisma.membership.create({
          data: {
            organizationId: dto.organizationId,
            userId: user.userId,
            role: OrganizationRole.DIRECTOR, // nebo TEACHER – na politice nezáleží, musí existovat membership
          },
          select: { id: true },
        });
      } else {
        throw new ForbiddenException('Nejste členem organizace.');
      }
    }

    if (dto.status === PublishStatus.PUBLISHED) {
      throw new BadRequestException(
        'Publish requires questions to be created first. Create test as DRAFT.',
      );
    }

    const created = await this.prisma.test.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        organizationId: dto.organizationId,
        status: dto.status ?? PublishStatus.DRAFT,
        creatorId: author.id,
      },
      include: this.includeAll(),
    });

    await this.audit({
      userId: user.userId,
      orgId: dto.organizationId ?? null,
      action: 'TEST_CREATE',
      entityId: created.id,
      changedFields: dto as unknown as Record<string, unknown>,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, dto.organizationId),
    );
    return created;
  }

  async findAll(user: JwtPayload, q: QueryTestsDto): Promise<unknown> {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;

    // ⬇️ dřív: non-super bral jen user.organizationId a query ignoroval
    const effectiveOrgId = isSuper
      ? (q.organizationId ?? null)
      : (q.organizationId ?? user.organizationId ?? null);

    if (!isSuper) {
      if (!effectiveOrgId) {
        throw new ForbiddenException('Missing organization context.');
      }
      // ověř, že uživatel je členem dané org
      const member = await this.prisma.membership.findFirst({
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

    const where: Prisma.TestWhereInput = {
      deletedAt: null,
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(searchExpr(q.search) ?? {}),
    };
    const include = this.includeAll();
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
      filters: { status: q.status ?? null, organizationId: effectiveOrgId },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.test.count({ where }),
        this.prisma.test.findMany({
          where,
          include,
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

  async findOne(id: string, user: JwtPayload): Promise<unknown> {
    const t = await this.prisma.test.findFirst({
      where: { id, deletedAt: null },
      include: this.includeAll(),
    });
    if (!t) throw new NotFoundException('Test nenalezen');

    if (user.systemRole === SystemRole.SUPERADMIN) return t;

    // ⬇️ dřív: if (t.organizationId !== user.organizationId) -> 403
    const member = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: t.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Cizí organizace.');

    return t;
  }
  async update(id: string, dto: UpdateTestDto, user: JwtPayload): Promise<unknown> {
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

    await this.ensureCanEditTest(user, current);

    if (dto.status === PublishStatus.PUBLISHED) {
      await this.ensureTestScoreable(id);
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

    const updated = await this.prisma.test.update({
      where: { id },
      data: updateData,
      include: this.includeAll(),
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

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (
        user.organizationId !== current.organizationId ||
        user.organizationRole !== OrganizationRole.DIRECTOR
      ) {
        throw new ForbiddenException('Mazat smí jen ředitel nebo superadmin.');
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
      select: { id: true, organizationId: true },
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    await this.ensureTestScoreable(test.id);

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== test.organizationId) {
        throw new ForbiddenException('Cizí organizace');
      }
    }

    const organizationId = dto.organizationId ?? test.organizationId;

    if (organizationId !== test.organizationId) {
      throw new ForbiddenException('Test a assignment musí být ve stejné org');
    }

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true },
    });
    if (!classSection || classSection.orgId !== organizationId) {
      throw new BadRequestException('Class section neexistuje nebo cizí org');
    }

    const creatorMembership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId,
        role: { in: [OrganizationRole.TEACHER, OrganizationRole.DIRECTOR] },
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

  async results(testId: string, user: JwtPayload): Promise<unknown> {
    const test = await this.prisma.test.findFirst({
      where: { id: testId, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== test.organizationId) {
        throw new ForbiddenException('Cizí organizace');
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

    const submissions = await this.prisma.submission.findMany({
      where: {
        testId,
        assignment: assignmentScope ?? { organizationId: test.organizationId },
        deletedAt: null,
        ...(role === OrganizationRole.STUDENT && membership
          ? { studentId: membership.id }
          : {}),
      },
      include: {
        assignment: { select: { id: true, classSectionId: true } },
        student: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((s) => ({
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
    }));
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
    const answers = this.buildAnswerFields({
      type: dto.type,
      correctAnswer: dto.correctAnswer,
      correctAnswers: dto.correctAnswers,
    });
    const q = await this.prisma.question.create({
      data: {
        testId,
        text: dto.text,
        type: dto.type,
        order: dto.order ?? 0,
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
