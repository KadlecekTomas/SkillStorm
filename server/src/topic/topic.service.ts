// src/topic/topic.service.ts
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { AssignTestsDto } from './dto/assign-tests.dto';
import { AssignMaterialsDto } from './dto/assign-materials.dto';

import { JwtPayload } from 'src/auth/types/jwt-payload';
import {
  Prisma,
  AuditEntityType,
  Difficulty,
  TopicPhase,
} from '@prisma/client';

import { assertSameOrganization } from 'src/shared/access.utils';
import {
  bumpOrgVersion,
  cacheScopeForUser,
  getOrgVersion,
  buildVersionedListKey,
  cacheGetOrSet,
} from '../shared/cache/org-cache.utils';

@Injectable()
export class TopicsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ------- helpers -------
  private async getOrgIdBySubjectLevelId(
    subjectLevelId: string,
  ): Promise<string> {
    const sl = await this.prisma.subjectLevel.findUnique({
      where: { id: subjectLevelId },
      select: { subject: { select: { organizationId: true } } },
    });
    if (!sl) throw new NotFoundException('SubjectLevel nebyl nalezen.');
    return sl.subject.organizationId;
  }

  private async getTopicLevelOrg(topicLevelId: string) {
    const tl = await this.prisma.topicLevel.findUnique({
      where: { id: topicLevelId },
      select: {
        subjectLevel: {
          select: { subject: { select: { organizationId: true } } },
        },
      },
    });
    if (!tl) throw new NotFoundException('TopicLevel nebyl nalezen.');
    return tl.subjectLevel.subject.organizationId;
  }

  private async audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, any>;
    changedFields?: Record<string, any>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.ORGANIZATION,
        entityId: opts.entityId ?? null,
        action: opts.action,
        metadata: opts.metadata ?? null,
        changedFields: opts.changedFields ?? null,
      },
    });
  }

  // jen „bezpečné“ include (žádné assignments atd. – ty se dotáhnou ručně)
  private includeBase() {
    return Prisma.validator<Prisma.TopicLevelInclude>()({
      catalogTopic: true,
      subjectLevel: { include: { subject: true } },
    });
  }

  // složí payload tak, jak to chtějí testy:
  // - LearningMaterial: [{ id, title }]
  // - assignments: [{ testId, order, isPrimary }]
  private async buildTopicPayload(topicId: string) {
    const topic = await this.prisma.topicLevel.findUnique({
      where: { id: topicId },
      include: this.includeBase(),
    });
    if (!topic) return null;

    // materiály (join tabulka -> vrátíme LearningMaterial[])
    const matAssigns = await this.prisma.materialAssignment.findMany({
      where: { topicLevelId: topicId },
      include: {
        // POZOR: pokud se relation v schema jmenuje jinak (např. "material"),
        // přejmenuj tento klíč z "learningMaterial" na správný.
        material: { select: { id: true, title: true } },
      },
      orderBy: { order: 'asc' },
    });
    const LearningMaterial = matAssigns.map((a) => a.material);

    // testy (join tabulka -> vrátíme assignments[])
    const testAssigns = await this.prisma.testAssignment.findMany({
      where: { topicLevelId: topicId },
      select: { testId: true, order: true, isPrimary: true },
      orderBy: { order: 'asc' },
    });

    return {
      ...topic,
      LearningMaterial,
      assignments: testAssigns,
    };
  }

  private search(search?: string): Prisma.TopicLevelWhereInput | undefined {
    const raw = search?.trim();
    if (!raw) return undefined;
    const s = raw.replace(/\s+/g, ' ');
    return {
      OR: [
        { name: { contains: s, mode: 'insensitive' } },
        {
          catalogTopic: { is: { name: { contains: s, mode: 'insensitive' } } },
        },
      ],
    };
  }

  // ------- CREATE -------
  async create(dto: CreateTopicDto, user: JwtPayload) {
    const orgId = await this.getOrgIdBySubjectLevelId(dto.subjectLevelId);
    assertSameOrganization(orgId, user, 'téma');

    const catalogOk = await this.prisma.catalogTopic.findUnique({
      where: { id: dto.catalogTopicId },
      select: { id: true },
    });
    if (!catalogOk) throw new NotFoundException('CatalogTopic neexistuje.');

    const phase = dto.phase ?? TopicPhase.INTRO;
    const exists = await this.prisma.topicLevel.findUnique({
      where: {
        subjectLevelId_catalogTopicId_phase: {
          subjectLevelId: dto.subjectLevelId,
          catalogTopicId: dto.catalogTopicId,
          phase,
        },
      },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        'Tento TopicLevel (phase) už v daném SubjectLevel existuje.',
      );
    }

    const created = await this.prisma.topicLevel.create({
      data: {
        subjectLevelId: dto.subjectLevelId,
        catalogTopicId: dto.catalogTopicId,
        name: dto.name?.trim() ?? null,
        phase,
        difficulty: dto.difficulty ?? Difficulty.BASIC,
        order: dto.order ?? null,
      },
      include: this.includeBase(),
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_CREATE',
      entityId: created.id,
      changedFields: dto as any,
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(created.id);
    return { ...(payload as any), organizationId: orgId };
  }

  // ------- LIST (versioned cache) -------
  async findAll(user: JwtPayload, q: QueryTopicsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    let where: Prisma.TopicLevelWhereInput = {};
    let orgScope = 'ALL';
    if (user.systemRole !== 'SUPERADMIN') {
      orgScope = user.organizationId!;
      where = {
        subjectLevel: { subject: { organizationId: user.organizationId } },
      };
    }
    if (q.subjectId) {
      where = { ...where, subjectLevel: { subject: { id: q.subjectId } } };
    }
    if (q.subjectLevelId) {
      where = { ...where, subjectLevelId: q.subjectLevelId };
    }
    const s = this.search(q.search);
    if (s) where = { AND: [where, s] };

    const include = this.includeBase();
    const version = await getOrgVersion(this.cache, orgScope);
    const cacheKey = buildVersionedListKey({
      namespace: 'topics',
      scopeId: orgScope,
      version,
      page,
      limit,
      search: q.search,
      order: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
      filters: {
        subjectId: q.subjectId ?? null,
        subjectLevelId: q.subjectLevelId ?? null,
        super: user.systemRole === 'SUPERADMIN',
      },
    });

    return cacheGetOrSet(this.cache, cacheKey, 300_000, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.topicLevel.count({ where }),
        this.prisma.topicLevel.findMany({
          where,
          include,
          orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
      ]);
      return {
        data,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  // ------- DETAIL (versioned cache) -------
  async findOne(id: string, user: JwtPayload) {
    const base = await this.prisma.topicLevel.findUnique({
      where: { id },
      select: {
        subjectLevel: {
          select: { subject: { select: { organizationId: true } } },
        },
      },
    });
    if (!base) throw new NotFoundException('Téma nebylo nalezeno.');
    const orgId = base.subjectLevel.subject.organizationId;
    assertSameOrganization(orgId, user, 'téma');

    const scope = cacheScopeForUser(user.systemRole, orgId);
    const version = await getOrgVersion(this.cache, scope);
    const cacheKey = `topics:detail:${id}:v${version}:scope:${scope}`;

    return cacheGetOrSet(this.cache, cacheKey, 300_000, async () => {
      const payload = await this.buildTopicPayload(id);
      if (!payload) throw new NotFoundException('Téma nebylo nalezeno.');
      return payload;
    });
  }

  // ------- BY SUBJECT (versioned cache) -------
  async findBySubjectId(subjectId: string, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { organizationId: true },
    });
    if (!subj) throw new NotFoundException('Předmět nebyl nalezen.');
    assertSameOrganization(subj.organizationId, user, 'předmět');

    const scope = cacheScopeForUser(user.systemRole, subj.organizationId);
    const version = await getOrgVersion(this.cache, scope);
    const cacheKey = buildVersionedListKey({
      namespace: 'topics-by-subject',
      scopeId: scope,
      version,
      filters: { subjectId },
      order: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
      page: 1,
      limit: 1000,
    });

    return cacheGetOrSet(this.cache, cacheKey, 300_000, async () => {
      return this.prisma.topicLevel.findMany({
        where: { subjectLevel: { subjectId } },
        include: this.includeBase(),
        orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
      });
    });
  }

  // ------- UPDATE -------
  async update(id: string, dto: UpdateTopicDto, user: JwtPayload) {
    const current = await this.prisma.topicLevel.findUnique({
      where: { id },
      include: { subjectLevel: { include: { subject: true } } },
    });
    if (!current) throw new NotFoundException('Téma nebylo nalezeno.');

    const orgId = current.subjectLevel.subject.organizationId;
    assertSameOrganization(orgId, user, 'téma');

    const nextSubjectLevelId = dto.subjectLevelId ?? current.subjectLevelId;
    const nextCatalogTopicId = dto.catalogTopicId ?? current.catalogTopicId;
    const nextPhase = dto.phase ?? current.phase;

    if (
      nextSubjectLevelId !== current.subjectLevelId ||
      nextCatalogTopicId !== current.catalogTopicId ||
      nextPhase !== current.phase
    ) {
      const dupe = await this.prisma.topicLevel.findUnique({
        where: {
          subjectLevelId_catalogTopicId_phase: {
            subjectLevelId: nextSubjectLevelId,
            catalogTopicId: nextCatalogTopicId,
            phase: nextPhase,
          },
        },
        select: { id: true },
      });
      if (dupe && dupe.id !== id) {
        throw new ConflictException('Tento TopicLevel (phase) už existuje.');
      }
    }

    await this.prisma.topicLevel.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        subjectLevelId: dto.subjectLevelId ?? undefined,
        catalogTopicId: dto.catalogTopicId ?? undefined,
        phase: dto.phase ?? undefined,
        difficulty: dto.difficulty ?? undefined,
        order: dto.order ?? undefined,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_UPDATE',
      entityId: id,
      changedFields: dto as any,
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(id);
    return { ...(payload as any), organizationId: orgId };
  }

  // ------- DELETE -------
  async remove(id: string, user: JwtPayload) {
    const current = await this.prisma.topicLevel.findUnique({
      where: { id },
      include: { subjectLevel: { include: { subject: true } } },
    });
    if (!current) throw new NotFoundException('Téma nebylo nalezeno.');
    const orgId = current.subjectLevel.subject.organizationId;
    assertSameOrganization(orgId, user, 'téma');

    const deleted = await this.prisma.topicLevel.delete({ where: { id } });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_DELETE',
      entityId: id,
      metadata: {
        subjectLevelId: current.subjectLevelId,
        catalogTopicId: current.catalogTopicId,
        phase: current.phase,
      },
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));
    return { ...deleted, organizationId: orgId };
  }

  // ------- MATERIALS -------
  async assignMaterials(
    topicLevelId: string,
    dto: AssignMaterialsDto,
    user: JwtPayload,
  ) {
    const orgId = await this.getTopicLevelOrg(topicLevelId);
    assertSameOrganization(orgId, user, 'téma');

    const materials = await this.prisma.learningMaterial.findMany({
      where: {
        id: { in: dto.materialIds },
        OR: [{ organizationId: null }, { organizationId: orgId }],
        deletedAt: null,
      },
      select: { id: true },
    });
    if (materials.length !== dto.materialIds.length) {
      throw new NotFoundException(
        'Některé materiály neexistují, jsou smazané nebo mimo organizaci.',
      );
    }

    if (dto.replaceAll) {
      await this.prisma.$transaction(async (tx) => {
        await tx.materialAssignment.deleteMany({ where: { topicLevelId } });
        if (materials.length) {
          await tx.materialAssignment.createMany({
            data: materials.map((m, i) => ({
              topicLevelId,
              materialId: m.id,
              isPrimary: i === 0,
              order: i + 1,
            })),
            skipDuplicates: true,
          });
        }
      });
    } else {
      const existing = await this.prisma.materialAssignment.findMany({
        where: { topicLevelId, materialId: { in: dto.materialIds } },
        select: { materialId: true },
      });
      const have = new Set(existing.map((e) => e.materialId));
      const toAdd = materials.filter((m) => !have.has(m.id));
      if (toAdd.length) {
        const last = await this.prisma.materialAssignment.findFirst({
          where: { topicLevelId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        const start = (last?.order ?? 0) + 1;
        await this.prisma.materialAssignment.createMany({
          data: toAdd.map((m, idx) => ({
            topicLevelId,
            materialId: m.id,
            isPrimary: false,
            order: start + idx,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit({
      userId: user.userId,
      orgId,
      action: dto.replaceAll
        ? 'TOPICLEVEL_MATERIALS_REPLACE'
        : 'TOPICLEVEL_MATERIALS_ADD',
      entityId: topicLevelId,
      metadata: { materialIds: dto.materialIds, replaceAll: !!dto.replaceAll },
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(topicLevelId);
    return { ...(payload as any), organizationId: orgId };
  }

  async removeMaterial(
    topicLevelId: string,
    materialId: string,
    user: JwtPayload,
  ) {
    const orgId = await this.getTopicLevelOrg(topicLevelId);
    assertSameOrganization(orgId, user, 'téma');

    await this.prisma.materialAssignment.deleteMany({
      where: { topicLevelId, materialId },
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_MATERIAL_REMOVE',
      entityId: topicLevelId,
      metadata: { materialId },
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(topicLevelId);
    return { ...(payload as any), organizationId: orgId };
  }

  // ------- TESTS -------
  async assignTests(
    topicLevelId: string,
    dto: AssignTestsDto,
    user: JwtPayload,
  ) {
    const orgId = await this.getTopicLevelOrg(topicLevelId);
    assertSameOrganization(orgId, user, 'téma');

    const tests = await this.prisma.test.findMany({
      where: {
        id: { in: dto.testIds },
        organizationId: orgId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (tests.length !== dto.testIds.length) {
      throw new NotFoundException(
        'Některé testy neexistují nebo nejsou v organizaci.',
      );
    }

    if (dto.replaceAll) {
      await this.prisma.$transaction(async (tx) => {
        await tx.testAssignment.deleteMany({ where: { topicLevelId } });
        if (tests.length) {
          await tx.testAssignment.createMany({
            data: tests.map((t, i) => ({
              topicLevelId,
              testId: t.id,
              isPrimary: i === 0,
              order: i + 1,
            })),
            skipDuplicates: true,
          });
        }
      });
    } else {
      const existing = await this.prisma.testAssignment.findMany({
        where: { topicLevelId, testId: { in: dto.testIds } },
        select: { testId: true },
      });
      const have = new Set(existing.map((e) => e.testId));
      const toAdd = tests.filter((t) => !have.has(t.id));
      if (toAdd.length) {
        const last = await this.prisma.testAssignment.findFirst({
          where: { topicLevelId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        const start = (last?.order ?? 0) + 1;
        await this.prisma.testAssignment.createMany({
          data: toAdd.map((t, idx) => ({
            topicLevelId,
            testId: t.id,
            isPrimary: false,
            order: start + idx,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit({
      userId: user.userId,
      orgId,
      action: dto.replaceAll
        ? 'TOPICLEVEL_TESTS_REPLACE'
        : 'TOPICLEVEL_TESTS_ADD',
      entityId: topicLevelId,
      metadata: { testIds: dto.testIds, replaceAll: !!dto.replaceAll },
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(topicLevelId);
    return { ...(payload as any), organizationId: orgId };
  }

  async removeTest(topicLevelId: string, testId: string, user: JwtPayload) {
    const orgId = await this.getTopicLevelOrg(topicLevelId);
    assertSameOrganization(orgId, user, 'téma');

    await this.prisma.testAssignment.deleteMany({
      where: { topicLevelId, testId },
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_TEST_REMOVE',
      entityId: topicLevelId,
      metadata: { testId },
    });

    await bumpOrgVersion(this.cache, cacheScopeForUser(user.systemRole, orgId));

    const payload = await this.buildTopicPayload(topicLevelId);
    return { ...(payload as any), organizationId: orgId };
  }

  // ------- Catalog (read-only; bez org-cache) -------
  async listCatalogSubjects() {
    return this.prisma.catalogSubject.findMany({
      select: { id: true, code: true, name: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async listCatalogTopics(subjectId: string, search?: string) {
    const where: Prisma.CatalogTopicWhereInput = {
      subjectId,
      ...(search?.trim()
        ? { name: { contains: search.trim(), mode: 'insensitive' } }
        : {}),
    };
    return this.prisma.catalogTopic.findMany({
      where,
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }],
    });
  }
}
