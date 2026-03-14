import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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

  private subjectListInclude(includeLevels?: boolean) {
    return Prisma.validator<Prisma.SubjectInclude>()({
      catalogSubject: true,
      levels: includeLevels ? { include: { topics: true } } : false,
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

  private async resolveSubjectOrgId(subjectId: string, user: JwtPayload): Promise<string | null> {
    if (user.organizationId) {
      const scoped = await this.prisma.orgSubject.findFirst({
        where: { subjectId, organizationId: user.organizationId },
        select: { organizationId: true },
      });
      if (scoped) return scoped.organizationId;
    }
    const fallback = await this.prisma.orgSubject.findFirst({
      where: { subjectId },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    });
    return fallback?.organizationId ?? null;
  }

  private assertSubjectScope(user: JwtPayload, orgId: string | null, context = 'předmět') {
    if (user.systemRole === SystemRole.SUPERADMIN) return;
    if (!orgId) {
      throw new ForbiddenException(
        `Přístup k tomuto ${context} je omezen na vlastní organizaci.`,
      );
    }
    assertReadScope(user, orgId, context);
  }

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
      where.orgSubjects = {
        some: {
          organizationId: user.organizationId,
          ...(q.includeInactive ? {} : { isEnabled: true }),
        },
      };
    }

    const s = makeSubjectSearch(q.search);
    if (s) Object.assign(where, s);

    if (q.grade) {
      where.levels = { some: { grade: q.grade, isEnabled: true } };
    }

    const include = this.subjectListInclude(q.includeLevels);
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
      ...(q.grade ? { grade: q.grade } : {}),
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

  async findOne(id: string, user: JwtPayload) {
    const include = this.subjectDetailInclude();
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include,
    });
    if (!subject || subject.deletedAt) {
      throw new NotFoundException('Předmět nebyl nalezen');
    }

    const orgId = await this.resolveSubjectOrgId(id, user);
    this.assertSubjectScope(user, orgId, 'předmět');
    return subject;
  }

  async findLevels(subjectId: string, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, deletedAt: true },
    });
    if (!subj || subj.deletedAt) {
      throw new NotFoundException('Předmět nebyl nalezen');
    }
    const orgId = await this.resolveSubjectOrgId(subjectId, user);
    this.assertSubjectScope(user, orgId, 'předmět');

    return this.prisma.subjectLevel.findMany({
      where: { subjectId },
      include: { topics: true },
      orderBy: [{ grade: 'asc' }, { order: 'asc' }],
    });
  }

  async toggleSubjectLevel(subjectId: string, grade: string, isEnabled: boolean, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, deletedAt: true },
    });
    if (!subj || subj.deletedAt) {
      throw new NotFoundException('Předmět nebyl nalezen');
    }
    const orgId = await this.resolveSubjectOrgId(subjectId, user);
    if (!orgId && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Přístup k tomuto předmětu je omezen na vlastní organizaci.');
    }
    assertTeacherOrDirectorInOrgOrSuperadmin(user, orgId ?? user.organizationId ?? '', 'předmět');

    const level = await this.prisma.subjectLevel.findFirst({
      where: { subjectId, grade: grade as any },
      select: { id: true },
    });
    if (!level) {
      throw new NotFoundException('SubjectLevel pro daný ročník nebyl nalezen');
    }

    const updated = await this.prisma.subjectLevel.update({
      where: { id: level.id },
      data: { isEnabled },
      include: { subject: { select: { id: true } } },
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: isEnabled ? 'SUBJECT_LEVEL_ENABLE' : 'SUBJECT_LEVEL_DISABLE',
      entityId: updated.id,
      metadata: { subjectId, grade },
    });
    if (orgId) {
      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, orgId),
      );
    }
    return updated;
  }

  async findTopicLevels(subjectId: string, user: JwtPayload) {
    const subj = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, deletedAt: true },
    });
    if (!subj || subj.deletedAt) {
      throw new NotFoundException('Předmět nebyl nalezen');
    }
    const orgId = await this.resolveSubjectOrgId(subjectId, user);
    this.assertSubjectScope(user, orgId, 'předmět');

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
