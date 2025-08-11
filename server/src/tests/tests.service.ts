// src/tests/tests.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  Prisma,
  AuditEntityType,
  SystemRole,
  OrganizationRole,
  PublishStatus,
} from '@prisma/client';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { QueryTestsDto } from './dto/query-tests.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';

import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '../../shared/cache/org-cache.utils';

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
    changedFields?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.TEST,
        entityId: opts.entityId ?? null,
        action: opts.action,
        ipAddress: opts.ip ?? null,
        userAgent: opts.ua ?? null,
        changedFields: opts.changedFields ?? null,
      },
    });
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

  // ====== TESTS ===================================================
  async create(dto: CreateTestDto, user: JwtPayload) {
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
      orgId: dto.organizationId,
      action: 'TEST_CREATE',
      entityId: created.id,
      changedFields: dto as any,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, dto.organizationId),
    );
    return created;
  }

  async findAll(user: JwtPayload, q: QueryTestsDto) {
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
      search: q.search,
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

  async findOne(id: string, user: JwtPayload) {
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
  async update(id: string, dto: UpdateTestDto, user: JwtPayload) {
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

    const updated = await this.prisma.test.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        status: dto.status ?? undefined,
      },
      include: this.includeAll(),
    });

    await this.audit({
      userId: user.userId,
      orgId: current.organizationId,
      action: 'TEST_UPDATE',
      entityId: id,
      changedFields: dto as any,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return updated;
  }

  async remove(id: string, user: JwtPayload) {
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
      orgId: current.organizationId,
      action: 'TEST_DELETE_SOFT',
      entityId: id,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return deleted;
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
  async addQuestion(testId: string, dto: CreateQuestionDto, user: JwtPayload) {
    const t = await this.getEditableTestFor(user, testId);
    const q = await this.prisma.question.create({
      data: { testId, text: dto.text, type: dto.type, order: dto.order ?? 0 },
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
  ) {
    const t = await this.getEditableTestFor(user, testId);
    const exists = await this.prisma.question.findFirst({
      where: { id: questionId, testId },
    });
    if (!exists) throw new NotFoundException('Otázka nenalezena');
    const q = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        text: dto.text ?? undefined,
        type: dto.type ?? undefined,
        order: dto.order ?? undefined,
      },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'QUESTION_UPDATE',
      entityId: q.id,
      changedFields: dto as any,
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
  ) {
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
      changedFields: dto as any,
    });
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, t.organizationId),
    );
    return { ok: true };
  }

  async removeQuestion(testId: string, questionId: string, user: JwtPayload) {
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
  ) {
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
  ) {
    const t = await this.getEditableTestFor(user, testId);
    const exists = await this.prisma.option.findFirst({
      where: { id: optionId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Možnost nenalezena');
    const o = await this.prisma.option.update({
      where: { id: optionId },
      data: { text: dto.text ?? undefined },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'OPTION_UPDATE',
      entityId: o.id,
      changedFields: dto as any,
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
  ) {
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
  ) {
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
  ) {
    const t = await this.getEditableTestFor(user, testId);
    const exists = await this.prisma.answer.findFirst({
      where: { id: answerId, questionId, question: { testId } },
    });
    if (!exists) throw new NotFoundException('Odpověď nenalezena');
    const a = await this.prisma.answer.update({
      where: { id: answerId },
      data: { text: dto.text ?? undefined },
    });
    await this.audit({
      userId: user.userId,
      orgId: t.organizationId,
      action: 'ANSWER_UPDATE',
      entityId: a.id,
      changedFields: dto as any,
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
  ) {
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
