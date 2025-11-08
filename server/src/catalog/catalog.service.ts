import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SchoolGrade,
  SystemRole,
  TopicPhase,
  Difficulty,
  AuditEntityType,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryCatalogDto } from './dto/query-catalog.dto';
import { CreateCatalogSubjectDto } from './dto/create-catalog-subject.dto';
import { UpdateCatalogSubjectDto } from './dto/update-catalog-subject.dto';
import { CreateCatalogTopicDto } from './dto/create-catalog-topic.dto';
import { UpdateCatalogTopicDto } from './dto/update-catalog-topic.dto';
import { MaterializeSubjectDto } from './dto/materialize-subject.dto';
import { MaterializeTopicDto } from './dto/materialize-topic.dto';
import { MaterializeTopicsBulkDto } from './dto/materialize-topics-bulk.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { assertSameOrganization } from 'src/shared/access.utils';
import {
  bumpOrgVersion,
  cacheScopeForUser,
} from '../shared/cache/org-cache.utils';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---------------- GLOBAL CACHE (catalog READ) ----------------
  private globalVersionKey = 'global_catalog_version';

  private async getGlobalVersion(): Promise<number> {
    const v = await this.cache.get<number>(this.globalVersionKey);
    return typeof v === 'number' ? v : 1;
  }
  private async bumpGlobalVersion() {
    const v = await this.getGlobalVersion();
    await this.cache.set(this.globalVersionKey, v + 1, 0);
  }

  private async cacheGetOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }

  // ---------------- AUDIT ----------------
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

  // ---------------- READ (catalog) ----------------
  async listSubjects(q: QueryCatalogDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;
    const term = (q.search ?? '').trim();

    const ver = await this.getGlobalVersion();
    const cacheKey = `catalog:subjects:v${ver}:p${page}:l${limit}:s=${term}`;

    return this.cacheGetOrSet(cacheKey, 300_000, async () => {
      if (!term) {
        const [total, data] = await this.prisma.$transaction([
          this.prisma.catalogSubject.count(),
          this.prisma.catalogSubject.findMany({
            select: { id: true, code: true, name: true },
            orderBy: [{ name: 'asc' }],
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

      // DIACRITICS-TOLERANT SEARCH (requires CREATE EXTENSION unaccent; fallback na ILIKE)
      try {
        // 1) najdi matching IDs přes unaccent
        const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
          `
        SELECT cs.id
        FROM catalog_subjects cs
        WHERE unaccent(lower(cs.name)) LIKE '%' || unaccent(lower($1)) || '%'
           OR unaccent(lower(cs.code)) LIKE '%' || unaccent(lower($1)) || '%'
        ORDER BY cs.name ASC, cs.id ASC
        OFFSET $2 LIMIT $3
        `,
          term,
          skip,
          limit,
        );
        const ids = rows.map((r) => r.id);

        // total (bez limitu)
        const totalRows: Array<{ count: string }> =
          await this.prisma.$queryRawUnsafe(
            `
        SELECT COUNT(*)::text as count
        FROM catalog_subjects cs
        WHERE unaccent(lower(cs.name)) LIKE '%' || unaccent(lower($1)) || '%'
           OR unaccent(lower(cs.code)) LIKE '%' || unaccent(lower($1)) || '%'
        `,
            term,
          );
        const total = parseInt(totalRows[0]?.count ?? '0', 10);

        const data = ids.length
          ? await this.prisma.catalogSubject.findMany({
              where: { id: { in: ids } },
              select: { id: true, code: true, name: true },
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
            })
          : [];

        return {
          data,
          meta: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        };
      } catch {
        // Fallback, pokud unaccent není k dispozici
        const where = {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { code: { contains: term, mode: 'insensitive' as const } },
          ],
        };
        const [total, data] = await this.prisma.$transaction([
          this.prisma.catalogSubject.count({ where }),
          this.prisma.catalogSubject.findMany({
            where,
            select: { id: true, code: true, name: true },
            orderBy: [{ name: 'asc' }],
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
    });
  }

  async getSubject(id: string) {
    const ver = await this.getGlobalVersion();
    const cacheKey = `catalog:subject:${id}:v${ver}`;
    return this.cacheGetOrSet(cacheKey, 300_000, async () => {
      const subj = await this.prisma.catalogSubject.findUnique({
        where: { id },
        select: { id: true, code: true, name: true },
      });
      if (!subj) throw new NotFoundException('CatalogSubject nenalezen.');
      return subj;
    });
  }

  async listTopicsByCatalogSubject(id: string, q: QueryCatalogDto) {
    // ověř, že subject existuje (kvůli 404 a hezké cache segmentaci)
    const exists = await this.prisma.catalogSubject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('CatalogSubject nenalezen.');

    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogTopicWhereInput = {
      subjectId: id,
      ...(q.search?.trim()
        ? { name: { contains: q.search.trim(), mode: 'insensitive' } }
        : {}),
    };

    const ver = await this.getGlobalVersion();
    const cacheKey = `catalog:topics:subject:${id}:v${ver}:p${page}:l${limit}:s=${q.search ?? ''}`;

    return this.cacheGetOrSet(cacheKey, 300_000, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.catalogTopic.count({ where }),
        this.prisma.catalogTopic.findMany({
          where,
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }],
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

  async getTopic(id: string) {
    const ver = await this.getGlobalVersion();
    const cacheKey = `catalog:topic:${id}:v${ver}`;
    return this.cacheGetOrSet(cacheKey, 300_000, async () => {
      const topic = await this.prisma.catalogTopic.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          subjectId: true,
          subject: { select: { id: true, code: true, name: true } },
        },
      });
      if (!topic) throw new NotFoundException('CatalogTopic nenalezen.');
      return topic;
    });
  }

  // ---------------- CRUD (SUPERADMIN) ----------------
  async createCatalogSubject(dto: CreateCatalogSubjectDto) {
    try {
      const created = await this.prisma.catalogSubject.create({
        data: { code: dto.code.trim(), name: dto.name.trim() },
        select: { id: true, code: true, name: true },
      });
      await this.bumpGlobalVersion();
      return created;
    } catch (e) {
      if ((e as PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Subject s tímto kódem už existuje.');
      }
      throw e;
    }
  }

  async updateCatalogSubject(id: string, dto: UpdateCatalogSubjectDto) {
    const existing = await this.prisma.catalogSubject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('CatalogSubject nenalezen.');
    const updated = await this.prisma.catalogSubject.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
      },
      select: { id: true, code: true, name: true },
    });
    await this.bumpGlobalVersion();
    return updated;
  }

  async deleteCatalogSubject(id: string) {
    const existing = await this.prisma.catalogSubject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('CatalogSubject nenalezen.');
    await this.prisma.catalogSubject.delete({ where: { id } });
    await this.bumpGlobalVersion();
    return { ok: true };
  }

  async createCatalogTopic(subjectId: string, dto: CreateCatalogTopicDto) {
    // preferuj subjectId z path; DTO subjectId ber jen jako guard
    if (dto.subjectId && dto.subjectId !== subjectId) {
      throw new ForbiddenException(
        'subjectId v těle se liší od path parametru.',
      );
    }
    const subj = await this.prisma.catalogSubject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });
    if (!subj) throw new NotFoundException('CatalogSubject neexistuje.');

    try {
      const created = await this.prisma.catalogTopic.create({
        data: { subjectId, name: dto.name.trim() },
        select: { id: true, subjectId: true, name: true },
      });
      await this.bumpGlobalVersion();
      return created;
    } catch (e) {
      if ((e as PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException(
          'Pro tento katalogový předmět už téma s tímto názvem existuje.',
        );
      }
      throw e;
    }
  }

  async updateCatalogTopic(id: string, dto: UpdateCatalogTopicDto) {
    const existing = await this.prisma.catalogTopic.findUnique({
      where: { id },
      select: { id: true, subjectId: true },
    });
    if (!existing) throw new NotFoundException('CatalogTopic nenalezen.');

    try {
      const updated = await this.prisma.catalogTopic.update({
        where: { id },
        data: {
          subjectId: dto.subjectId ?? undefined,
          name: dto.name?.trim(),
        },
        select: { id: true, subjectId: true, name: true },
      });
      await this.bumpGlobalVersion();
      return updated;
    } catch (e: any) {
      if (e.code === 'P2002') {
        // uniq constraint [subjectId, name]
        throw new ConflictException(
          'Pro cílový katalogový předmět už téma s tímto názvem existuje.',
        );
      }
      throw e;
    }
  }

  async deleteCatalogTopic(id: string) {
    const existing = await this.prisma.catalogTopic.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('CatalogTopic nenalezen.');
    await this.prisma.catalogTopic.delete({ where: { id } });
    await this.bumpGlobalVersion();
    return { ok: true };
  }

  // ---------------- MATERIALIZE ----------------
  async materializeSubject(
    catalogSubjectId: string,
    dto: MaterializeSubjectDto,
    user: JwtPayload,
  ) {
    // DIRECTOR/TEACHER: pouze v rámci své organizace
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      assertSameOrganization(dto.organizationId, user, 'organizace');
    }

    const cat = await this.prisma.catalogSubject.findUnique({
      where: { id: catalogSubjectId },
      select: { id: true, name: true },
    });
    if (!cat) throw new NotFoundException('CatalogSubject nenalezen.');

    // unikát [organizationId, catalogSubjectId]
    const name = (dto.nameOverride ?? cat.name).trim();

    const created = await this.prisma.subject
      .create({
        data: {
          organizationId: dto.organizationId,
          catalogSubjectId: cat.id,
          name,
        },
        select: {
          id: true,
          organizationId: true,
          catalogSubjectId: true,
          name: true,
        },
      })
      .catch((e) => {
        if ((e as PrismaClientKnownRequestError).code === 'P2002') {
          throw new ConflictException(
            'Tento katalogový předmět už je v organizaci přidán.',
          );
        }
        throw e;
      });

    // volitelně vytvoř SubjectLevel pro vybrané ročníky
    if (
      Array.isArray(dto.createLevelsForGrades) &&
      dto.createLevelsForGrades.length > 0
    ) {
      const distinct = Array.from(
        new Set(dto.createLevelsForGrades as SchoolGrade[]),
      );
      await this.prisma.subjectLevel.createMany({
        data: distinct.map((grade) => ({ subjectId: created.id, grade })),
        skipDuplicates: true,
      });
    }

    await this.audit({
      userId: user.userId,
      orgId: dto.organizationId,
      action: 'CATALOG_SUBJECT_MATERIALIZE',
      entityId: created.id,
      metadata: {
        catalogSubjectId,
        createLevelsForGrades: dto.createLevelsForGrades ?? [],
      },
    });

    // invalidace org listů (subjects/levels)
    const scope = cacheScopeForUser(user.systemRole, dto.organizationId);
    await bumpOrgVersion(this.cache, scope);

    return created;
  }

  async materializeTopic(
    catalogTopicId: string,
    dto: MaterializeTopicDto,
    user: JwtPayload,
  ) {
    // vezmi org přes SubjectLevel → Subject
    const sl = await this.prisma.subjectLevel.findUnique({
      where: { id: dto.subjectLevelId },
      select: { subject: { select: { organizationId: true, id: true } } },
    });
    if (!sl) throw new NotFoundException('SubjectLevel nenalezen.');
    const orgId = sl.subject.organizationId;

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      assertSameOrganization(orgId, user, 'organizace');
    }

    // ověř, že katalogové téma existuje
    const ct = await this.prisma.catalogTopic.findUnique({
      where: { id: catalogTopicId },
      select: { id: true },
    });
    if (!ct) throw new NotFoundException('CatalogTopic nenalezen.');

    const phase = dto.phase ?? TopicPhase.INTRO;
    const difficulty = dto.difficulty ?? Difficulty.BASIC;

    // unikát [subjectLevelId, catalogTopicId, phase]
    const created = await this.prisma.topicLevel
      .create({
        data: {
          subjectLevelId: dto.subjectLevelId,
          catalogTopicId,
          name: null, // necháme prázdné -> z katalogu se čte pro zobrazení, nebo si může učitel přepsat v TopicsService.update
          phase,
          difficulty,
          order: dto.order ?? null,
        },
        include: {
          catalogTopic: true,
          subjectLevel: { include: { subject: true } },
          LearningMaterial: true,
        },
      })
      .catch((e) => {
        if ((e as PrismaClientKnownRequestError).code === 'P2002') {
          throw new ConflictException(
            'Tento TopicLevel (phase) už existuje v daném SubjectLevel.',
          );
        }
        throw e;
      });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'CATALOG_TOPIC_MATERIALIZE',
      entityId: created.id,
      metadata: { catalogTopicId },
    });

    const scope = cacheScopeForUser(user.systemRole, orgId);
    await bumpOrgVersion(this.cache, scope);

    return created;
  }

  async materializeTopicsBulk(
    catalogSubjectId: string,
    dto: MaterializeTopicsBulkDto,
    user: JwtPayload,
  ) {
    // validace subjectLevel + org
    const sl = await this.prisma.subjectLevel.findUnique({
      where: { id: dto.subjectLevelId },
      select: { subject: { select: { organizationId: true, id: true } } },
    });
    if (!sl) throw new NotFoundException('SubjectLevel nenalezen.');
    const orgId = sl.subject.organizationId;
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      assertSameOrganization(orgId, user, 'organizace');
    }

    // získej katalogová témata pro daný CatalogSubject
    const topics = await this.prisma.catalogTopic.findMany({
      where: { id: { in: dto.catalogTopicIds }, subjectId: catalogSubjectId },
      select: { id: true },
    });
    if (topics.length !== dto.catalogTopicIds.length) {
      throw new NotFoundException(
        'Některé CatalogTopic neexistují nebo nepatří do zadaného CatalogSubject.',
      );
    }

    const phase = dto.defaultPhase ?? TopicPhase.INTRO;
    const difficulty = dto.defaultDifficulty ?? Difficulty.BASIC;

    // zjisti start order
    let startOrder = dto.appendAfter ?? 0;
    if (startOrder === 0) {
      const last = await this.prisma.topicLevel.findFirst({
        where: { subjectLevelId: dto.subjectLevelId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      startOrder = last?.order ?? 0;
    }

    // vytvoř postupně (kvůli unique constraintu)
    const createdIds: string[] = [];
    for (let i = 0; i < topics.length; i++) {
      const catalogTopicId = topics[i].id;
      try {
        const created = await this.prisma.topicLevel.create({
          data: {
            subjectLevelId: dto.subjectLevelId,
            catalogTopicId,
            name: null,
            phase,
            difficulty,
            order: startOrder + i + 1,
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      } catch (e) {
        if ((e as PrismaClientKnownRequestError).code === 'P2002') {
          // už existuje — přeskoč
          continue;
        }
        throw e;
      }
    }

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'CATALOG_TOPICS_MATERIALIZE_BULK',
      entityId: null,
      metadata: {
        catalogSubjectId,
        subjectLevelId: dto.subjectLevelId,
        createdCount: createdIds.length,
      },
    });

    const scope = cacheScopeForUser(user.systemRole, orgId);
    await bumpOrgVersion(this.cache, scope);

    return { createdCount: createdIds.length, createdIds };
  }
}
