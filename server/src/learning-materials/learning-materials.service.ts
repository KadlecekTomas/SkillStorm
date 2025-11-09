import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateLearningMaterialDto } from './dto/create-learning-material.dto';
import { UpdateLearningMaterialDto } from './dto/update-learning-material.dto';
import { QueryLearningMaterialsDto } from './dto/query-learning-materials.dto';
import { JwtPayload } from '@/auth/types/jwt-payload';
import {
  Prisma,
  AuditEntityType,
  SystemRole,
  OrganizationRole,
  ContentScope,
  MaterialAccessLevel,
  XpEventType,
} from '@prisma/client';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '../shared/cache/org-cache.utils';
import * as path from 'path';
import * as fs from 'fs';
import type { File as MulterFile } from 'multer';
import { GamificationService } from '@/gamification/gamification.service';

function materialSearch(
  search?: string,
): Prisma.LearningMaterialWhereInput | undefined {
  const raw = search?.trim();
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, ' ');
  return {
    OR: [
      { title: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
    ],
  };
}

// jednoduchý MIME sniff pro PDF (bez dalších libek): kontrola magic bytes "%PDF"
function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  const header = buf.subarray(0, 4).toString('utf8');
  return header === '%PDF';
}

@Injectable()
export class LearningMaterialsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly gamification: GamificationService,
  ) {}

  // ---------- Audit helper ----------
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    ip?: string | null;
    ua?: string | null;
    metadata?: Record<string, any>;
    changedFields?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.LEARNING_MATERIAL,
        entityId: opts.entityId ?? null,
        action: opts.action,
        ipAddress: opts.ip ?? null,
        userAgent: opts.ua ?? null,
        metadata: opts.metadata ?? null,
        changedFields: opts.changedFields ?? null,
      },
    });
  }

  private includeAll() {
    return Prisma.validator<Prisma.LearningMaterialInclude>()({
      subject: true,
      topicLevel: true,
      organization: true,
      createdBy: { include: { user: true, organization: true } },
    });
  }

  // ---------- CREATE ----------
  async create(
    dto: CreateLearningMaterialDto,
    user: JwtPayload,
    ctx?: { ip?: string; ua?: string },
  ) {
    const scope = dto.scope ?? ContentScope.ORGANIZATION;
    const orgId = dto.organizationId ?? null;
    const uid = user.userId;

    // 1) Org context + membership autora
    if (scope === ContentScope.GLOBAL && orgId) {
      throw new BadRequestException(
        'Pro GLOBAL scope nesmí být vyplněn organizationId.',
      );
    }

    // SUPERADMIN může vše, TEACHER/DIRECTOR jen v rámci své org
    const sameOrg = !!orgId && user.organizationId === orgId;
    const allowed =
      user.systemRole === SystemRole.SUPERADMIN ||
      (sameOrg &&
        (user.organizationRole === OrganizationRole.DIRECTOR ||
          user.organizationRole === OrganizationRole.TEACHER));

    if (!allowed) {
      throw new ForbiddenException(
        'Nemáte oprávnění vytvořit materiál v této organizaci.',
      );
    }

    // membership: pro ORGANIZATION vyžadujeme členství v té org;
    // pro GLOBAL (kvůli možnému NOT NULL na createdById) použij libovolné existující členství uživatele
    let authorMembershipId: string | null = null;

    if (scope === ContentScope.ORGANIZATION) {
      const authorMembership = await this.prisma.membership.findFirst({
        where: {
          userId: uid,
          organizationId: orgId!,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!authorMembership) {
        throw new ForbiddenException('Autor není členem dané organizace.');
      }
      authorMembershipId = authorMembership.id;
    } else {
      // GLOBAL
      const anyMember = await this.prisma.membership.findFirst({
        where: { userId: uid, deletedAt: null },
        select: { id: true },
      });
      authorMembershipId = anyMember?.id ?? null;
    }

    // volitelné FK validace (pokud posláno)
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: dto.subjectId,
          organizationId: orgId ?? undefined,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!subject)
        throw new BadRequestException('Subject neexistuje v dané organizaci.');
    }
    if (dto.topicLevelId) {
      const tl = await this.prisma.topicLevel.findFirst({
        where: { id: dto.topicLevelId },
        select: { id: true },
      });
      if (!tl) throw new BadRequestException('TopicLevel neexistuje.');
    }

    // accessLevel PAID ⇒ price vyžadována (zajištěno i v DTO přes ValidateIf)
    if (
      dto.accessLevel === MaterialAccessLevel.PAID &&
      (dto.price === undefined || dto.price === null)
    ) {
      throw new BadRequestException(
        'Pro placený materiál je nutné zadat price.',
      );
    }

    const created = await this.prisma.learningMaterial.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        contentType: dto.contentType,
        educationLevel: dto.educationLevel,
        schoolGrade: dto.schoolGrade ?? null,
        subjectId: dto.subjectId ?? null,
        topicLevelId: dto.topicLevelId ?? null,
        scope,
        organizationId: orgId,
        createdById: authorMembershipId, // pro GLOBAL fallback na libovolné členství
        accessLevel: dto.accessLevel ?? MaterialAccessLevel.FREE,
        price: dto.price ?? null,
        isDownloadable: dto.isDownloadable ?? true,
      },
      include: this.includeAll(),
    });

    await this.audit({
      userId: uid,
      orgId: orgId,
      action: 'MATERIAL_CREATE',
      entityId: created.id,
      changedFields: dto as any,
      ip: ctx?.ip ?? null,
      ua: ctx?.ua ?? null,
    });

    await bumpOrgVersion(
      this.cache,
      scope === ContentScope.GLOBAL
        ? 'GLOBAL'
        : cacheScopeForUser(user.systemRole, orgId!),
    );
    return created;
  }

  // ---------- LIST ----------
  async findAll(user: JwtPayload, q: QueryLearningMaterialsDto) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;

    // Org scoping – superadmin bez orgId vidí jen GLOBAL; s orgId vidí i ORG
    let effectiveOrgId: string | null = q.organizationId ?? null;

    if (!isSuper) {
      effectiveOrgId = q.organizationId ?? user.organizationId ?? null;
      if (!effectiveOrgId)
        throw new ForbiddenException('Missing organization context.');
    }

    const where: Prisma.LearningMaterialWhereInput = {
      deletedAt: null,
      ...(q.scope ? { scope: q.scope } : {}),
      ...(q.contentType ? { contentType: q.contentType } : {}),
      ...(q.educationLevel ? { educationLevel: q.educationLevel } : {}),
      ...(q.schoolGrade ? { schoolGrade: q.schoolGrade } : {}),
      ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      ...(q.topicLevelId ? { topicLevelId: q.topicLevelId } : {}),
    };

    if (isSuper) {
      if (effectiveOrgId) {
        // když superadmin pošle organizationId, filtruj na tu ORG
        where.organizationId = effectiveOrgId;
      } else {
        // ⬇️ NOVÉ: bez orgId ukaž jen GLOBAL
        where.scope = ContentScope.GLOBAL;
      }
    } else {
      where.OR = [
        { scope: ContentScope.GLOBAL },
        { organizationId: effectiveOrgId },
      ];
    }
    const t = materialSearch(q.search);
    if (t) Object.assign(where, t);

    const include = this.includeAll();

    const scopeId = effectiveOrgId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'learning-materials',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search,
      order: [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      filters: {
        scope: q.scope ?? null,
        contentType: q.contentType ?? null,
        educationLevel: q.educationLevel ?? null,
        schoolGrade: q.schoolGrade ?? null,
        subjectId: q.subjectId ?? null,
        topicLevelId: q.topicLevelId ?? null,
      },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.learningMaterial.count({ where }),
        this.prisma.learningMaterial.findMany({
          where,
          include,
          orderBy: [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
          skip,
          take: limit,
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

  // ---------- DETAIL ----------
  async findOne(id: string, user: JwtPayload) {
    const uid = user.userId;

    const m = await this.prisma.learningMaterial.findFirst({
      where: { id, deletedAt: null },
      include: this.includeAll(),
    });
    if (!m) throw new NotFoundException('LearningMaterial not found');

    if (user.systemRole === SystemRole.SUPERADMIN) return m;
    if (m.scope === ContentScope.GLOBAL) return m;

    const member = await this.prisma.membership.findFirst({
      where: {
        userId: uid,
        organizationId: m.organizationId,
        deletedAt: null,
      },
      select: { id: true, role: true },
    });
    if (!member) throw new ForbiddenException('Access denied');

    if (member.role === OrganizationRole.STUDENT) {
      await this.gamification.awardXpForEvent(
        member.id,
        XpEventType.MATERIAL_VIEWED,
        10,
        { materialId: m.id },
      );
    }

    return m;
  }

  // ---------- UPDATE ----------
  async update(
    id: string,
    dto: UpdateLearningMaterialDto,
    user: JwtPayload,
    ctx?: { ip?: string; ua?: string },
  ) {
    const uid = user.userId;

    const current = await this.prisma.learningMaterial.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        scope: true,
        createdById: true,
        deletedAt: true,
      },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Material not found');

    const sameOrg =
      user.organizationId && current.organizationId === user.organizationId;
    const isDirector =
      user.organizationRole === OrganizationRole.DIRECTOR && !!sameOrg;

    const author = await this.prisma.membership.findFirst({
      where: { id: current.createdById, userId: uid },
      select: { id: true },
    });

    if (
      !(user.systemRole === SystemRole.SUPERADMIN || isDirector || !!author)
    ) {
      throw new ForbiddenException('Nemáte oprávnění upravit tento materiál.');
    }

    if (dto.organizationId || dto.scope) {
      throw new BadRequestException(
        'Změna scope/organizationId není povolena.',
      );
    }

    const updated = await this.prisma.learningMaterial.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        contentType: dto.contentType ?? undefined,
        educationLevel: dto.educationLevel ?? undefined,
        schoolGrade: dto.schoolGrade ?? undefined,
        subjectId: dto.subjectId ?? undefined,
        topicLevelId: dto.topicLevelId ?? undefined,
        accessLevel: dto.accessLevel ?? undefined,
        price: dto.price ?? undefined,
        isDownloadable: dto.isDownloadable ?? undefined,
      },
      include: this.includeAll(),
    });

    await this.audit({
      userId: uid,
      orgId: current.organizationId,
      action: 'MATERIAL_UPDATE',
      entityId: id,
      changedFields: dto as any,
      ip: ctx?.ip ?? null,
      ua: ctx?.ua ?? null,
    });
    await bumpOrgVersion(
      this.cache,
      current.scope === ContentScope.GLOBAL
        ? 'GLOBAL'
        : cacheScopeForUser(
            user.systemRole,
            current.organizationId ?? 'GLOBAL',
          ),
    );
    return updated;
  }

  // ---------- DELETE (soft) ----------
  async remove(
    id: string,
    user: JwtPayload,
    ctx?: { ip?: string; ua?: string },
  ) {
    const uid = user.userId;

    const current = await this.prisma.learningMaterial.findUnique({
      where: { id },
      select: { id: true, organizationId: true, scope: true, deletedAt: true },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Material not found');

    const sameOrg = user.organizationId === current.organizationId;
    const allowed =
      user.systemRole === SystemRole.SUPERADMIN ||
      (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR);
    if (!allowed)
      throw new ForbiddenException(
        'Pouze ředitel nebo superadmin může smazat materiál.',
      );

    const deleted = await this.prisma.learningMaterial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit({
      userId: uid,
      orgId: current.organizationId,
      action: 'MATERIAL_DELETE_SOFT',
      entityId: id,
      ip: ctx?.ip ?? null,
      ua: ctx?.ua ?? null,
    });
    await bumpOrgVersion(
      this.cache,
      current.scope === ContentScope.GLOBAL
        ? 'GLOBAL'
        : cacheScopeForUser(
            user.systemRole,
            current.organizationId ?? 'GLOBAL',
          ),
    );
    return deleted;
  }

  // ---------- ATTACH FILE (PDF) ----------
  async attachFile(
    id: string,
    file: MulterFile,
    user: JwtPayload,
    ctx?: { ip?: string; ua?: string },
  ) {
    const uid = user.userId ?? user.userId;

    const m = await this.prisma.learningMaterial.findUnique({
      where: { id },
      select: { id: true, organizationId: true, scope: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundException('Material not found');

    const sameOrg = user.organizationId === m.organizationId;
    const allowed =
      user.systemRole === SystemRole.SUPERADMIN ||
      (sameOrg &&
        (user.organizationRole === OrganizationRole.DIRECTOR ||
          user.organizationRole === OrganizationRole.TEACHER));

    if (!allowed)
      throw new ForbiddenException('Nemáte oprávnění nahrát soubor.');

    if (!isPdfBuffer(Buffer.from(file.buffer))) {
      throw new BadRequestException(
        'Soubor nevypadá jako platné PDF (chybí PDF magic bytes).',
      );
    }

    // uložit na disk (MVP) → /uploads/materials/<id>.pdf
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'materials');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const targetPath = path.join(uploadsDir, `${id}.pdf`);
    fs.writeFileSync(targetPath, file.buffer);

    const publicUrl = `/uploads/materials/${id}.pdf`;

    const updated = await this.prisma.learningMaterial.update({
      where: { id },
      data: { fileUrl: publicUrl },
    });

    await this.audit({
      userId: uid,
      orgId: m.organizationId,
      action: 'MATERIAL_FILE_ATTACH',
      entityId: id,
      ip: ctx?.ip ?? null,
      ua: ctx?.ua ?? null,
      metadata: {
        fileUrl: publicUrl,
        bytes: file.size,
        mimetype: file.mimetype,
      },
    });

    const scopeId =
      m.scope === ContentScope.GLOBAL
        ? 'GLOBAL'
        : (m.organizationId ?? 'GLOBAL');
    await bumpOrgVersion(this.cache, scopeId);

    return updated;
  }
}
