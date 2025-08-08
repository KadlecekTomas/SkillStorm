import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import {
  Prisma,
  AuditEntityType,
  Difficulty,
  TopicPhase,
} from '@prisma/client';
import { assertSameOrganization } from 'shared/access.utils';
import {
  bumpOrgVersion,
  cacheScopeForUser,
} from 'shared/cache/org-cache.utils';
import { AssignTestsDto } from './dto/assign-tests.dto';
import { AssignMaterialsDto } from './dto/assign-materials.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

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

  private include() {
    return Prisma.validator<Prisma.TopicLevelInclude>()({
      catalogTopic: true,
      subjectLevel: { include: { subject: true } },
      LearningMaterial: true,
    });
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
    // validuj subjectLevel + org
    const orgId = await this.getOrgIdBySubjectLevelId(dto.subjectLevelId);
    assertSameOrganization(orgId, user, 'téma');

    // katalog musí existovat
    const catalogOk = await this.prisma.catalogTopic.findUnique({
      where: { id: dto.catalogTopicId },
      select: { id: true },
    });
    if (!catalogOk) throw new NotFoundException('CatalogTopic neexistuje.');

    // volitelně: neduplikovat stejnou kombinaci (schema už hlídá unique: [subjectLevelId, catalogTopicId, phase])
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
      include: this.include(),
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_CREATE',
      entityId: created.id,
      changedFields: dto as any,
    });

    return created;
  }

  // ------- LIST -------
  async findAll(user: JwtPayload, q: QueryTopicsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    // superadmin → všechny; jinak jen vlastní org
    let where: Prisma.TopicLevelWhereInput = {};
    if (user.systemRole !== 'SUPERADMIN') {
      where = {
        subjectLevel: { subject: { organizationId: user.organizationId } },
      };
    }

    if (q.subjectId) {
      where = {
        ...where,
        subjectLevel: { subject: { id: q.subjectId } },
      };
    }
    if (q.subjectLevelId) {
      where = { ...where, subjectLevelId: q.subjectLevelId };
    }

    const s = this.search(q.search);
    if (s) where = { AND: [where, s] };

    const include = this.include();

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

  async assignMaterials(
    topicLevelId: string,
    dto: AssignMaterialsDto,
    user: JwtPayload,
  ) {
    const orgId = await this.getTopicLevelOrg(topicLevelId);
    assertSameOrganization(orgId, user, 'téma');

    // ověř, že materiály jsou v rámci stejné org (scope u LM je optional; ale pokud mají orgId, musí sedět)
    const materials = await this.prisma.learningMaterial.findMany({
      where: {
        id: { in: dto.materialIds },
        OR: [
          { organizationId: null }, // globální/volně přiřaditelné (pokud to tak chceš)
          { organizationId: orgId },
        ],
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
        // přidáme za konec
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
    return this.findOne(topicLevelId, user);
  }

  // ------- BY SUBJECT -------
  async findBySubjectId(subjectId: string, user: JwtPayload) {
    // ověř subject + org
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { organizationId: true },
    });
    if (!subj) throw new NotFoundException('Předmět nebyl nalezen.');
    assertSameOrganization(subj.organizationId, user, 'předmět');

    return this.prisma.topicLevel.findMany({
      where: { subjectLevel: { subjectId } },
      include: this.include(),
      orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
    });
  }

  // ------- DETAIL -------
  async findOne(id: string, user: JwtPayload) {
    const tl = await this.prisma.topicLevel.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!tl) throw new NotFoundException('Téma nebylo nalezeno.');
    assertSameOrganization(
      tl.subjectLevel.subject.organizationId,
      user,
      'téma',
    );
    return tl;
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

    // hlídej unikátní trojici, pokud se mění (subjectLevelId / catalogTopicId / phase)
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

    const updated = await this.prisma.topicLevel.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        subjectLevelId: dto.subjectLevelId ?? undefined,
        catalogTopicId: dto.catalogTopicId ?? undefined,
        phase: dto.phase ?? undefined,
        difficulty: dto.difficulty ?? undefined,
        order: dto.order ?? undefined,
      },
      include: this.include(),
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'TOPICLEVEL_UPDATE',
      entityId: id,
      changedFields: dto as any,
    });

    return updated;
  }

  // ------- DELETE -------
  async remove(id: string, user: JwtPayload) {
    const current = await this.prisma.topicLevel.findUnique({
      where: { id },
      include: { subjectLevel: { include: { subject: true } } },
    });
    if (!current) throw new NotFoundException('Téma nebylo nalezeno.');
    assertSameOrganization(
      current.subjectLevel.subject.organizationId,
      user,
      'téma',
    );

    const deleted = await this.prisma.topicLevel.delete({ where: { id } });

    await this.audit({
      userId: user.userId,
      orgId: current.subjectLevel.subject.organizationId,
      action: 'TOPICLEVEL_DELETE',
      entityId: id,
      metadata: {
        subjectLevelId: current.subjectLevelId,
        catalogTopicId: current.catalogTopicId,
        phase: current.phase,
      },
    });

    return deleted;
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
    return { ok: true };
  }

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
    return this.findOne(topicLevelId, user);
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
    return { ok: true };
  }

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
