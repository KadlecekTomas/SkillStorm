import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, SchoolGrade } from '@prisma/client';
import {
  SystemRole,
  TopicPhase,
  Difficulty,
  AuditEntityType,
} from '@prisma/client';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '@/prisma/prisma.service';
import type { QueryCatalogDto } from './dto/query-catalog.dto';
import type { CreateCatalogSubjectDto } from './dto/create-catalog-subject.dto';
import type { UpdateCatalogSubjectDto } from './dto/update-catalog-subject.dto';
import type { CreateCatalogTopicDto } from './dto/create-catalog-topic.dto';
import type { UpdateCatalogTopicDto } from './dto/update-catalog-topic.dto';
import type { MaterializeSubjectDto } from './dto/materialize-subject.dto';
import type { MaterializeTopicDto } from './dto/materialize-topic.dto';
import type { MaterializeTopicsBulkDto } from './dto/materialize-topics-bulk.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditService } from '@/audit/audit.service';
import { assertSameOrganization } from '@/shared/access.utils';
import {
  bumpOrgVersion,
  cacheScopeForUser,
} from '@/shared/cache/org-cache.utils';
import type { PlatformQueryCatalogSubjectsDto } from './dto/platform-query-catalog-subjects.dto';
import type { PlatformQueryCatalogTopicsDto } from './dto/platform-query-catalog-topics.dto';
import type { PlatformCreateCatalogSubjectDto } from './dto/platform-create-catalog-subject.dto';
import type { PlatformUpdateCatalogSubjectDto } from './dto/platform-update-catalog-subject.dto';
import type { PlatformCreateCatalogTopicDto } from './dto/platform-create-catalog-topic.dto';
import type { PlatformUpdateCatalogTopicDto } from './dto/platform-update-catalog-topic.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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
    metadata?: Prisma.InputJsonValue;
    changedFields?: Prisma.InputJsonValue;
    entityType?: AuditEntityType;
    systemRole?: string | null | undefined;
  }) {
    const event = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      systemRole: opts.systemRole ?? null,
      entityType: opts.entityType ?? AuditEntityType.ORGANIZATION,
      entityId: opts.entityId ?? null,
      action: opts.action,
      ...(opts.metadata !== undefined ? { metadata: opts.metadata } : {}),
      ...(opts.changedFields !== undefined
        ? { changedFields: opts.changedFields }
        : {}),
    };
    await this.auditService.log(event);
  }

  private normalizeSubjectCode(value: string) {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private normalizeLabel(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private comparableLabel(value: string) {
    return this.normalizeLabel(value).toLocaleLowerCase('en-US');
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
          this.prisma.catalogSubject.count({
            where: { deletedAt: null, isActive: true },
          }),
          this.prisma.catalogSubject.findMany({
            where: { deletedAt: null, isActive: true },
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
          deletedAt: null,
          isActive: true,
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
      const subj = await this.prisma.catalogSubject.findFirst({
        where: { id, deletedAt: null, isActive: true },
        select: { id: true, code: true, name: true },
      });
      if (!subj) throw new NotFoundException('CatalogSubject nenalezen.');
      return subj;
    });
  }

  async listTopicsByCatalogSubject(id: string, q: QueryCatalogDto) {
    // ověř, že subject existuje (kvůli 404 a hezké cache segmentaci)
    const exists = await this.prisma.catalogSubject.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('CatalogSubject nenalezen.');

    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogTopicWhereInput = {
      subjectId: id,
      deletedAt: null,
      isActive: true,
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
      const topic = await this.prisma.catalogTopic.findFirst({
        where: { id, deletedAt: null, isActive: true },
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
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
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
          ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
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

  // ---------------- PLATFORM CATALOG MANAGEMENT ----------------
  async listPlatformSubjects(query: PlatformQueryCatalogSubjectsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim() ?? '';
    const includeInactive = query.includeInactive ?? false;
    const sortBy = query.sortBy ?? 'name';
    const sortDir = query.sortDir ?? 'asc';
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogSubjectWhereInput = {
      ...(includeInactive ? {} : { deletedAt: null }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.CatalogSubjectOrderByWithRelationInput[] =
      sortBy === 'createdAt'
        ? [{ createdAt: sortDir }, { name: 'asc' }]
        : sortBy === 'code'
          ? [{ code: sortDir }, { createdAt: 'desc' }]
          : [{ name: sortDir }, { createdAt: 'desc' }];

    const [total, items] = await this.prisma.$transaction([
      this.prisma.catalogSubject.count({ where }),
      this.prisma.catalogSubject.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          deletedAt: true,
          createdAt: true,
          _count: {
            select: {
              topics: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        isActive: item.isActive,
        deletedAt: item.deletedAt,
        createdAt: item.createdAt,
        topicCount: item._count.topics,
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createPlatformSubject(
    dto: PlatformCreateCatalogSubjectDto,
    actor: JwtPayload,
  ) {
    const code = this.normalizeSubjectCode(dto.code);
    const name = this.normalizeLabel(dto.name);

    const duplicate = await this.prisma.catalogSubject.findFirst({
      where: { code },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Catalog subject code already exists.');
    }

    const created = await this.prisma.catalogSubject.create({
      data: {
        code,
        name,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      entityType: AuditEntityType.CATALOG_SUBJECT,
      entityId: created.id,
      action: 'CATALOG_SUBJECT_CREATE',
      changedFields: { code: created.code, name: created.name, isActive: true },
    });
    await this.bumpGlobalVersion();

    return {
      ...created,
      topicCount: 0,
    };
  }

  async updatePlatformSubject(
    id: string,
    dto: PlatformUpdateCatalogSubjectDto,
    actor: JwtPayload,
  ) {
    const existing = await this.prisma.catalogSubject.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        _count: {
          select: {
            topics: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('CatalogSubject nenalezen.');

    const nextCode =
      dto.code !== undefined
        ? this.normalizeSubjectCode(dto.code)
        : existing.code;
    const nextName =
      dto.name !== undefined ? this.normalizeLabel(dto.name) : existing.name;
    const nextIsActive = dto.isActive ?? existing.isActive;
    const nextDeletedAt = nextIsActive
      ? null
      : (existing.deletedAt ?? new Date());

    if (nextCode !== existing.code) {
      const duplicate = await this.prisma.catalogSubject.findFirst({
        where: {
          code: nextCode,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Catalog subject code already exists.');
      }
    }

    const updated = await this.prisma.catalogSubject.update({
      where: { id },
      data: {
        ...(nextCode !== existing.code ? { code: nextCode } : {}),
        ...(nextName !== existing.name ? { name: nextName } : {}),
        ...(nextIsActive !== existing.isActive
          ? { isActive: nextIsActive }
          : {}),
        ...(nextDeletedAt !== existing.deletedAt
          ? { deletedAt: nextDeletedAt }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        _count: {
          select: {
            topics: { where: { deletedAt: null } },
          },
        },
      },
    });

    const changedFields: Record<string, unknown> = {};
    if (existing.code !== updated.code)
      changedFields.code = { from: existing.code, to: updated.code };
    if (existing.name !== updated.name)
      changedFields.name = { from: existing.name, to: updated.name };
    if (existing.isActive !== updated.isActive)
      changedFields.isActive = {
        from: existing.isActive,
        to: updated.isActive,
      };
    if (
      existing.deletedAt?.toISOString() !== updated.deletedAt?.toISOString()
    ) {
      changedFields.deletedAt = {
        from: existing.deletedAt?.toISOString() ?? null,
        to: updated.deletedAt?.toISOString() ?? null,
      };
    }

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole,
      entityType: AuditEntityType.CATALOG_SUBJECT,
      entityId: updated.id,
      action: 'CATALOG_SUBJECT_UPDATE',
      changedFields: changedFields as Prisma.InputJsonValue,
    });
    await this.bumpGlobalVersion();

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      isActive: updated.isActive,
      deletedAt: updated.deletedAt,
      createdAt: updated.createdAt,
      topicCount: updated._count.topics,
    };
  }

  async deletePlatformSubject(id: string, actor: JwtPayload) {
    const existing = await this.prisma.catalogSubject.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        _count: {
          select: {
            topics: true,
            subjects: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('CatalogSubject nenalezen.');

    const shouldSoftDelete =
      existing._count.topics > 0 || existing._count.subjects > 0;

    if (shouldSoftDelete) {
      await this.prisma.catalogSubject.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: existing.deletedAt ?? new Date(),
        },
      });
    } else {
      await this.prisma.catalogSubject.delete({ where: { id } });
    }

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      entityType: AuditEntityType.CATALOG_SUBJECT,
      entityId: id,
      action: 'CATALOG_SUBJECT_DELETE',
      changedFields: {
        mode: shouldSoftDelete ? 'soft' : 'hard',
        topicCount: existing._count.topics,
        subjectCount: existing._count.subjects,
      },
    });
    await this.bumpGlobalVersion();

    return { ok: true, mode: shouldSoftDelete ? 'soft' : 'hard' };
  }

  async listPlatformTopics(query: PlatformQueryCatalogTopicsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim() ?? '';
    const includeInactive = query.includeInactive ?? false;
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogTopicWhereInput = {
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(includeInactive ? {} : { deletedAt: null }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.catalogTopic.count({ where }),
      this.prisma.catalogTopic.findMany({
        where,
        orderBy: [{ order: 'asc' }, { name: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          order: true,
          isActive: true,
          deletedAt: true,
          createdAt: true,
          subjectId: true,
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              topicLevels: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        subjectId: item.subjectId,
        subjectName: item.subject.name,
        subjectCode: item.subject.code,
        name: item.name,
        order: item.order,
        isActive: item.isActive,
        deletedAt: item.deletedAt,
        createdAt: item.createdAt,
        usageCount: item._count.topicLevels,
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createPlatformTopic(
    dto: PlatformCreateCatalogTopicDto,
    actor: JwtPayload,
  ) {
    const subject = await this.prisma.catalogSubject.findFirst({
      where: {
        id: dto.subjectId,
        deletedAt: null,
      },
      select: { id: true, name: true, code: true },
    });
    if (!subject) {
      throw new NotFoundException('CatalogSubject neexistuje.');
    }

    const name = this.normalizeLabel(dto.name);
    const comparable = this.comparableLabel(name);
    const siblings = await this.prisma.catalogTopic.findMany({
      where: { subjectId: dto.subjectId },
      select: { id: true, name: true },
    });
    if (
      siblings.some((item) => this.comparableLabel(item.name) === comparable)
    ) {
      throw new ConflictException(
        'Pro tento katalogový předmět už téma s tímto názvem existuje.',
      );
    }

    const created = await this.prisma.catalogTopic.create({
      data: {
        subjectId: dto.subjectId,
        name,
        order: dto.order ?? null,
        isActive: true,
      },
      select: {
        id: true,
        subjectId: true,
        name: true,
        order: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      entityType: AuditEntityType.CATALOG_TOPIC,
      entityId: created.id,
      action: 'CATALOG_TOPIC_CREATE',
      changedFields: {
        subjectId: created.subjectId,
        name: created.name,
        order: created.order,
        isActive: created.isActive,
      },
    });
    await this.bumpGlobalVersion();

    return {
      ...created,
      subjectName: subject.name,
      subjectCode: subject.code,
      usageCount: 0,
    };
  }

  async updatePlatformTopic(
    id: string,
    dto: PlatformUpdateCatalogTopicDto,
    actor: JwtPayload,
  ) {
    const existing = await this.prisma.catalogTopic.findUnique({
      where: { id },
      select: {
        id: true,
        subjectId: true,
        name: true,
        order: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            topicLevels: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('CatalogTopic nenalezen.');

    const nextName =
      dto.name !== undefined ? this.normalizeLabel(dto.name) : existing.name;
    const nextComparable = this.comparableLabel(nextName);
    if (nextName !== existing.name) {
      const siblings = await this.prisma.catalogTopic.findMany({
        where: {
          subjectId: existing.subjectId,
          id: { not: id },
        },
        select: { name: true },
      });
      if (
        siblings.some(
          (item) => this.comparableLabel(item.name) === nextComparable,
        )
      ) {
        throw new ConflictException(
          'Pro tento katalogový předmět už téma s tímto názvem existuje.',
        );
      }
    }

    const nextIsActive = dto.isActive ?? existing.isActive;
    const nextDeletedAt = nextIsActive
      ? null
      : (existing.deletedAt ?? new Date());

    const updated = await this.prisma.catalogTopic.update({
      where: { id },
      data: {
        ...(nextName !== existing.name ? { name: nextName } : {}),
        ...(dto.order !== undefined && dto.order !== existing.order
          ? { order: dto.order }
          : {}),
        ...(nextIsActive !== existing.isActive
          ? { isActive: nextIsActive }
          : {}),
        ...(nextDeletedAt !== existing.deletedAt
          ? { deletedAt: nextDeletedAt }
          : {}),
      },
      select: {
        id: true,
        subjectId: true,
        name: true,
        order: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            topicLevels: true,
          },
        },
      },
    });

    const changedFields: Record<string, unknown> = {};
    if (existing.name !== updated.name)
      changedFields.name = { from: existing.name, to: updated.name };
    if (existing.order !== updated.order)
      changedFields.order = { from: existing.order, to: updated.order };
    if (existing.isActive !== updated.isActive)
      changedFields.isActive = {
        from: existing.isActive,
        to: updated.isActive,
      };
    if (
      existing.deletedAt?.toISOString() !== updated.deletedAt?.toISOString()
    ) {
      changedFields.deletedAt = {
        from: existing.deletedAt?.toISOString() ?? null,
        to: updated.deletedAt?.toISOString() ?? null,
      };
    }

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole,
      entityType: AuditEntityType.CATALOG_TOPIC,
      entityId: updated.id,
      action: 'CATALOG_TOPIC_UPDATE',
      changedFields: changedFields as Prisma.InputJsonValue,
    });
    await this.bumpGlobalVersion();

    return {
      id: updated.id,
      subjectId: updated.subjectId,
      subjectName: updated.subject.name,
      subjectCode: updated.subject.code,
      name: updated.name,
      order: updated.order,
      isActive: updated.isActive,
      deletedAt: updated.deletedAt,
      createdAt: updated.createdAt,
      usageCount: updated._count.topicLevels,
    };
  }

  async deletePlatformTopic(id: string, actor: JwtPayload) {
    const existing = await this.prisma.catalogTopic.findUnique({
      where: { id },
      select: {
        id: true,
        deletedAt: true,
        _count: {
          select: {
            topicLevels: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('CatalogTopic nenalezen.');

    const shouldSoftDelete = existing._count.topicLevels > 0;
    if (shouldSoftDelete) {
      await this.prisma.catalogTopic.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: existing.deletedAt ?? new Date(),
        },
      });
    } else {
      await this.prisma.catalogTopic.delete({ where: { id } });
    }

    await this.audit({
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      entityType: AuditEntityType.CATALOG_TOPIC,
      entityId: id,
      action: 'CATALOG_TOPIC_DELETE',
      changedFields: {
        mode: shouldSoftDelete ? 'soft' : 'hard',
        usageCount: existing._count.topicLevels,
      },
    });
    await this.bumpGlobalVersion();

    return { ok: true, mode: shouldSoftDelete ? 'soft' : 'hard' };
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

    // globální Subject + org-level activation přes OrgSubject
    const name = (dto.nameOverride ?? cat.name).trim();

    const created = await this.prisma.subject.upsert({
      where: { catalogSubjectId: cat.id },
      update: { name },
      create: {
        catalogSubjectId: cat.id,
        name,
        gradeFrom: 1,
        gradeTo: 9,
      },
      select: {
        id: true,
        catalogSubjectId: true,
        name: true,
      },
    });
    await this.prisma.orgSubject.upsert({
      where: {
        organizationId_subjectId: {
          organizationId: dto.organizationId,
          subjectId: created.id,
        },
      },
      update: { isEnabled: true },
      create: {
        organizationId: dto.organizationId,
        subjectId: created.id,
        isEnabled: true,
        isCustom: false,
      },
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
    const orgSubjectsArgs = {
      ...(user.organizationId
        ? { where: { organizationId: user.organizationId } }
        : {}),
      select: { organizationId: true },
      take: 1,
      orderBy: { createdAt: 'asc' as const },
    };
    // vezmi org přes OrgSubject navázaný na Subject
    const sl = await this.prisma.subjectLevel.findUnique({
      where: { id: dto.subjectLevelId },
      include: {
        subject: {
          include: {
            orgSubjects: orgSubjectsArgs,
          },
        },
      },
    });
    if (!sl) throw new NotFoundException('SubjectLevel nenalezen.');
    const orgId = sl.subject.orgSubjects[0]?.organizationId ?? null;
    if (!orgId)
      throw new NotFoundException('Předmět není přiřazen žádné organizaci.');

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
    const orgSubjectsArgs = {
      ...(user.organizationId
        ? { where: { organizationId: user.organizationId } }
        : {}),
      select: { organizationId: true },
      take: 1,
      orderBy: { createdAt: 'asc' as const },
    };
    // validace subjectLevel + org
    const sl = await this.prisma.subjectLevel.findUnique({
      where: { id: dto.subjectLevelId },
      include: {
        subject: {
          include: {
            orgSubjects: orgSubjectsArgs,
          },
        },
      },
    });
    if (!sl) throw new NotFoundException('SubjectLevel nenalezen.');
    const orgId = sl.subject.orgSubjects[0]?.organizationId ?? null;
    if (!orgId)
      throw new NotFoundException('Předmět není přiřazen žádné organizaci.');
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
    for (const [i, topic] of topics.entries()) {
      const catalogTopicId = topic.id;
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
