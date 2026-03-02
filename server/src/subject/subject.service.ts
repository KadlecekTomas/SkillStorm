import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateSubjectDto } from './dto/create-subject.dto';
import type { UpdateSubjectDto } from './dto/update-subject.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { QuerySubjectsDto } from './dto/query-subjects.dto';
import { Prisma, SystemRole, AuditEntityType } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';
import {
  assertReadScope,
  assertTeacherOrDirectorInOrgOrSuperadmin,
  makeSubjectSearch,
} from '@/shared/access.utils';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** ---------- Audit helper ---------- */
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, any>;
    changedFields?: Record<string, any>;
  }) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: opts.entityId ?? null,
      action: opts.action,
    };
    if (opts.metadata !== undefined) {
      data.metadata = opts.metadata as Prisma.InputJsonValue;
    }
    if (opts.changedFields !== undefined) {
      data.changedFields = opts.changedFields as Prisma.InputJsonValue;
    }
    return this.prisma.auditLog.create({ data });
  }

  /** ---------- Includes (pevně typované) ---------- */
  private subjectListInclude(includeLevels?: boolean) {
    return Prisma.validator<Prisma.SubjectInclude>()({
      organization: true,
      catalogSubject: true,
      levels: includeLevels ? { include: { topics: true } } : false, // SubjectLevel[] + TopicLevel[]
      teachers: {
        include: {
          teacher: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      },
      learningMaterials: false,
    });
  }

  private subjectDetailInclude() {
    return Prisma.validator<Prisma.SubjectInclude>()({
      organization: true,
      catalogSubject: true,
      levels: { include: { topics: true } },
      teachers: {
        include: {
          teacher: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      },
      learningMaterials: true,
    });
  }

  /** ---------- CREATE ---------- */
  async create(dto: CreateSubjectDto, user: JwtPayload) {
    assertTeacherOrDirectorInOrgOrSuperadmin(
      user,
      dto.organizationId,
      'předmět',
    );

    if (dto.catalogSubjectId) {
      const exists = await this.prisma.catalogSubject.findUnique({
        where: { id: dto.catalogSubjectId },
        select: { id: true },
      });
      if (!exists)
        throw new NotFoundException('Zvolený katalogový předmět neexistuje.');
    }

    const dup = await this.prisma.subject.findFirst({
      where: {
        organizationId: dto.organizationId,
        name: dto.name.trim(),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (dup)
      throw new ConflictException(
        'Předmět se stejným názvem v organizaci již existuje.',
      );

    const created = await this.prisma.subject.create({
      data: {
        name: dto.name.trim(),
        organizationId: dto.organizationId,
        catalogSubjectId: dto.catalogSubjectId ?? null,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        catalogSubjectId: true,
        deletedAt: true,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: dto.organizationId,
      action: 'SUBJECT_CREATE',
      entityId: created.id,
      changedFields: dto as any,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, dto.organizationId),
    );
    return created; // obsahuje organizationId → controller invaliduje scope
  }

  /** ---------- LIST (search + pagination + cache s verzí) ---------- */
  async findAll(user: JwtPayload, q: QuerySubjectsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;
    const where: Prisma.SubjectWhereInput = { deletedAt: null };
    if (!isSuper) {
      if (!user.organizationId) {
        throw new ForbiddenException('Missing organization context.');
      }
      where.organizationId = user.organizationId;
    }

    // Default: active subjects only. ?includeInactive=true returns all non-deleted.
    if (!q.includeInactive) {
      where.isActive = true;
    }

    const s = makeSubjectSearch(q.search);
    if (s) Object.assign(where, s);

    const include = this.subjectListInclude(q.includeLevels);

    // cache key
    const scopeId = cacheScopeForUser(user.systemRole, user.organizationId);
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'subjects',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search ?? '',
      ...(q.includeLevels !== undefined ? { includeLevels: q.includeLevels } : {}),
      ...(q.includeInactive ? { includeInactive: true } : {}),
      order: [{ name: 'asc' }, { id: 'asc' }],
      filters: null,
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.subject.count({ where }),
        this.prisma.subject.findMany({
          where,
          include,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
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

  /** ---------- DETAIL ---------- */
  async findOne(id: string, user: JwtPayload) {
    const include = this.subjectDetailInclude();
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include,
    });
    if (!subject || subject.deletedAt)
      throw new NotFoundException('Předmět nebyl nalezen');

    assertReadScope(user, subject.organizationId, 'předmět');
    return subject;
  }

  /** ---------- UPDATE ---------- */
  async update(id: string, dto: UpdateSubjectDto, user: JwtPayload) {
    const current = await this.prisma.subject.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        catalogSubjectId: true,
        deletedAt: true,
      },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Předmět nebyl nalezen');

    assertTeacherOrDirectorInOrgOrSuperadmin(
      user,
      current.organizationId,
      'předmět',
    );

    if (dto.catalogSubjectId) {
      const exists = await this.prisma.catalogSubject.findUnique({
        where: { id: dto.catalogSubjectId },
        select: { id: true },
      });
      if (!exists)
        throw new NotFoundException('Zvolený katalogový předmět neexistuje.');
    }

    if (dto.name && dto.name.trim() !== current.name) {
      const dup = await this.prisma.subject.findFirst({
        where: {
          organizationId: current.organizationId,
          name: dto.name.trim(),
          deletedAt: null,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup)
        throw new ConflictException(
          'Předmět se stejným názvem v organizaci již existuje.',
        );
    }

    const data: Prisma.SubjectUncheckedUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.catalogSubjectId !== undefined) {
      data.catalogSubjectId = dto.catalogSubjectId;
    }

    const updated = await this.prisma.subject.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        organizationId: true,
        catalogSubjectId: true,
        deletedAt: true,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: current.organizationId,
      action: 'SUBJECT_UPDATE',
      entityId: id,
      changedFields: dto as any,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return updated; // obsahuje organizationId → controller invaliduje scope
  }

  /** ---------- ACTIVATE / DEACTIVATE ---------- */
  async setActive(id: string, isActive: boolean, user: JwtPayload) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: { id: true, organizationId: true, deletedAt: true, isActive: true },
    });
    if (!subject || subject.deletedAt) throw new NotFoundException('Předmět nebyl nalezen');

    assertTeacherOrDirectorInOrgOrSuperadmin(user, subject.organizationId, 'předmět');

    const updated = await this.prisma.subject.update({
      where: { id },
      data: { isActive },
      select: { id: true, organizationId: true, isActive: true },
    });

    await this.audit({
      userId: user.userId,
      orgId: subject.organizationId,
      action: isActive ? 'SUBJECT_ACTIVATE' : 'SUBJECT_DEACTIVATE',
      entityId: id,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, subject.organizationId),
    );
    return updated;
  }

  /** ---------- DELETE (soft) ---------- */
  async remove(id: string, user: JwtPayload) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: { id: true, name: true, organizationId: true },
    });
    if (!subject) throw new NotFoundException('Předmět nebyl nalezen');

    assertTeacherOrDirectorInOrgOrSuperadmin(
      user,
      subject.organizationId,
      'předmět',
    );

    const deleted = await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, organizationId: true },
    });

    await this.audit({
      userId: user.userId,
      orgId: subject.organizationId,
      action: 'SUBJECT_DELETE_SOFT',
      entityId: id,
      metadata: { name: subject.name },
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, subject.organizationId),
    );
    return deleted;
  }

  /** ---------- Subject → Levels ---------- */
  async findLevels(subjectId: string, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subj || subj.deletedAt)
      throw new NotFoundException('Předmět nebyl nalezen');
    assertReadScope(user, subj.organizationId, 'předmět');

    return this.prisma.subjectLevel.findMany({
      where: { subjectId },
      include: { topics: true }, // TopicLevel[]
      orderBy: [{ grade: 'asc' }, { order: 'asc' }],
    });
  }

  /** ---------- Subject → TopicLevels (přes Levels) ---------- */
  async findTopicLevels(subjectId: string, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subj || subj.deletedAt)
      throw new NotFoundException('Předmět nebyl nalezen');
    assertReadScope(user, subj.organizationId, 'předmět');

    const levels = await this.prisma.subjectLevel.findMany({
      where: { subjectId },
      select: { id: true },
    });
    if (levels.length === 0) return [];

    return this.prisma.topicLevel.findMany({
      where: { subjectLevelId: { in: levels.map((l) => l.id) } },
      include: { catalogTopic: true },
      orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }],
    });
  }
}
