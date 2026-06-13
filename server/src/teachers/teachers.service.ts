import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateTeacherDto } from './dto/create-teacher.dto';
import type { UpdateTeacherDto } from './dto/update-teacher.dto';
import type { QueryTeachersDto } from './dto/query-teachers.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import {
  Prisma,
  AuditEntityType,
  SystemRole,
  OrganizationRole,
} from '@prisma/client';
import { hasAtLeastRole } from '@/shared/access.utils';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  cacheScopeForUser,
  getResourceVersion,
  invalidateResourcesFailSafe,
} from '@/shared/cache/org-cache.utils';
import type { AssignSubjectsDto } from './dto/assign-subjects.dto';

function teacherSearch(search?: string): Prisma.TeacherWhereInput | undefined {
  const raw = search?.trim();
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, ' ');
  return {
    membership: {
      is: {
        user: {
          OR: [
            { name: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } },
            { username: { contains: s, mode: 'insensitive' } },
          ],
        },
      },
    },
  };
}

@Injectable()
export class TeachersService {
  private static readonly TEACHERS_CACHE_TTL_MS = 15_000;

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async invalidateTeacherReads(scopeId: string, mutation: string) {
    await invalidateResourcesFailSafe(this.cache, {
      scopeId,
      resources: ['teachers', 'dashboard'],
      mutation,
    });
  }

  // ---------- Audit ----------
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

  // ---------- Includes (typově bezpečné) ----------
  private teacherListInclude() {
    return Prisma.validator<Prisma.TeacherInclude>()({
      membership: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      subjects: { include: { subject: true } }, // TeacherSubject[] + Subject
      homeroomOf: { include: { academicYear: true } }, // ClassSection[]
    });
  }
  private teacherDetailInclude() {
    return this.teacherListInclude();
  }

  // ---------- CREATE ----------
  async create(dto: CreateTeacherDto, user: JwtPayload) {
    // membership existence
    const membership = await this.prisma.membership.findUnique({
      where: { id: dto.membershipId },
      select: { id: true, role: true, organizationId: true },
    });
    if (!membership)
      throw new NotFoundException('Zadané membershipId neexistuje.');

    // role TEACHER
    if (membership.role !== OrganizationRole.TEACHER) {
      throw new ConflictException('Membership nemá roli TEACHER.');
    }

    // membership patří do zadané org
    if (membership.organizationId !== dto.organizationId) {
      throw new ForbiddenException('Membership nepatří do zadané organizace.');
    }

    // povolení: superadmin nebo ředitel/owner té organizace
    const sameOrg = user.organizationId === dto.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg &&
          hasAtLeastRole(
            user.organizationRole ?? null,
            OrganizationRole.DIRECTOR,
          ))
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může vytvořit učitele.',
      );
    }

    // už existuje Teacher pro to membership?
    const exists = await this.prisma.teacher.findUnique({
      where: { membershipId: dto.membershipId },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException('Tento člen je již zapsán jako učitel.');

    const created = await this.prisma.teacher.create({
      data: {
        membershipId: dto.membershipId,
        organizationId: dto.organizationId,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: dto.organizationId,
      action: 'TEACHER_CREATE',
      entityId: created.id,
      changedFields: dto as any,
    });

    await this.invalidateTeacherReads(
      cacheScopeForUser(user.systemRole, dto.organizationId),
      'teachers.create',
    );
    return created;
  }

  // ---------- LIST (search + pagination + cache + soft delete) ----------
  // teachers.service.ts

  // ---------- LIST (search + pagination + cache + soft delete) ----------
  async findAll(user: JwtPayload, q: QueryTeachersDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;

    // 1) Urči efektivní org
    let effectiveOrgId: string | null = null;

    if (isSuper) {
      if (!q.organizationId) {
        throw new BadRequestException(
          'organizationId is required for SUPERADMIN.',
        );
      }
      effectiveOrgId = q.organizationId;
    } else {
      // pro nesuperadmina preferuj org z query (pokud přichází z UI), jinak z JWT
      effectiveOrgId = q.organizationId ?? user.organizationId ?? null;
      if (!effectiveOrgId) {
        throw new ForbiddenException('Missing organization context.');
      }

      // 2) Ověř, že volající je v té org ředitelem/ownerem (RBAC z controlleru neřeší org-scoping)
      const member = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: effectiveOrgId,
          role: { in: [OrganizationRole.DIRECTOR, OrganizationRole.OWNER] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!member) {
        // nechceme vyzrazovat existenci → klidně NotFound; pro testy držíme 403
        throw new ForbiddenException(
          'Cross-organization listing is forbidden.',
        );
      }
    }

    // 3) Filtry
    const where: Prisma.TeacherWhereInput = {
      deletedAt: null,
      organizationId: effectiveOrgId!,
    };
    const t = teacherSearch(q.search);
    if (t) Object.assign(where, t);

    const include = this.teacherListInclude();

    const scopeId = cacheScopeForUser(user.systemRole, effectiveOrgId);
    const version = await getResourceVersion(this.cache, scopeId, 'teachers');
    const cacheKey = buildVersionedListKey({
      namespace: 'teachers',
      scopeId,
      version,
      page,
      limit,
      search: q.search ?? '',
      order: [{ membership: { user: { name: 'asc' } } }, { id: 'asc' }],
      filters: { organizationId: effectiveOrgId },
    });

    return cacheGetOrSet(
      this.cache,
      cacheKey,
      TeachersService.TEACHERS_CACHE_TTL_MS,
      async () => {
        const [total, items] = await this.prisma.$transaction([
          this.prisma.teacher.count({ where }),
          this.prisma.teacher.findMany({
            where,
            include,
            orderBy: [{ membership: { user: { name: 'asc' } } }, { id: 'asc' }],
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
      },
      {
        scopeId,
        resource: 'teachers',
      },
    );
  }

  // ---------- DETAIL ----------
  async findOne(id: string, user: any) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: { subjects: { select: { subjectId: true } } }, // aby test "změna je vidět hned" prošel
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    // superadmin může vše
    if (user?.systemRole === SystemRole.SUPERADMIN) return teacher;

    // uživatel musí mít membership v té samé organizaci
    const member = await this.prisma.membership.findFirst({
      where: {
        userId: user?.userId ?? user?.sub,
        organizationId: teacher.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!member) {
      // pokud chceš maskovat existenci, můžeš dát místo 403 -> NotFoundException
      throw new ForbiddenException('Access denied');
    }

    return teacher;
  }

  // ---------- UPDATE ----------
  async update(id: string, dto: UpdateTeacherDto, user: JwtPayload) {
    const current = await this.prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        membershipId: true,
        organizationId: true,
        deletedAt: true,
      },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('Učitel nebyl nalezen');

    // superadmin nebo ředitel/owner dané školy
    const sameOrg = user.organizationId === current.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg &&
          hasAtLeastRole(
            user.organizationRole ?? null,
            OrganizationRole.DIRECTOR,
          ))
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může upravit učitele.',
      );
    }

    // bezpečnost: zákaz přehazování membership/org
    if (dto.membershipId && dto.membershipId !== current.membershipId) {
      throw new ConflictException('Změna membershipId není povolena.');
    }
    if (dto.organizationId && dto.organizationId !== current.organizationId) {
      throw new ConflictException('Změna organizationId není povolena.');
    }

    // momentálně není jiný mutovatelný scalar; hook pro rozšíření:
    const updated = await this.prisma.teacher.update({
      where: { id },
      data: {},
    });

    await this.audit({
      userId: user.userId,
      orgId: current.organizationId,
      action: 'TEACHER_UPDATE',
      entityId: id,
      changedFields: dto as any,
    });

    await this.invalidateTeacherReads(
      cacheScopeForUser(user.systemRole, current.organizationId),
      'teachers.update',
    );
    return updated;
  }

  // ---------- DELETE (soft) ----------
  async remove(id: string, user: JwtPayload) {
    // Soft delete: historické vazby (třídy/úkoly) musí zůstat auditně dohledatelné.
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!teacher) throw new NotFoundException('Učitel nebyl nalezen');

    const sameOrg = user.organizationId === teacher.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg &&
          hasAtLeastRole(
            user.organizationRole ?? null,
            OrganizationRole.DIRECTOR,
          ))
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může smazat učitele.',
      );
    }

    const deleted = await this.prisma.teacher.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit({
      userId: user.userId,
      orgId: teacher.organizationId,
      action: 'TEACHER_DELETE_SOFT',
      entityId: id,
    });

    await this.invalidateTeacherReads(
      cacheScopeForUser(user.systemRole, teacher.organizationId),
      'teachers.remove',
    );
    return deleted;
  }

  /**
   * Přiřazení předmětů učiteli.
   * - validace: superadmin nebo ředitel/owner stejné školy
   * - kontrola, že všechny subjectIds patří do stejné organizace jako teacher
   * - replaceAll=true → transakčně smaže ostatní vazby a přidá jen uvedené
   * - replaceAll=false/undefined → pouze doplní chybějící vazby
   * - audit + cache invalidace (teachers+subjects scope)
   */
  async assignSubjects(
    teacherId: string,
    dto: AssignSubjectsDto,
    user: JwtPayload,
  ) {
    // 1) Učitel existuje + není soft‑deleted
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!teacher || teacher.deletedAt) {
      throw new NotFoundException('Učitel nebyl nalezen');
    }

    // 2) RBAC: SUPERADMIN nebo DIRECTOR téže organizace
    const sameOrg = user.organizationId === teacher.organizationId;
    const isAllowed =
      user.systemRole === SystemRole.SUPERADMIN ||
      (sameOrg &&
        hasAtLeastRole(
          user.organizationRole ?? null,
          OrganizationRole.DIRECTOR,
        ));

    if (!isAllowed) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může přiřazovat předměty.',
      );
    }

    // 3) Normalizace inputu
    const uniqueIds = Array.from(new Set(dto.subjectIds ?? []));
    if (uniqueIds.length === 0) {
      // replaceAll s prázdným polem = odstraní vše, add režim s prázdnem = no‑op
      // necháme to projít – chování vyřešíme níž
    }

    // 4) Validace subjectů + org scoping
    if (uniqueIds.length > 0) {
      const subjectsAll = await this.prisma.orgSubject.findMany({
        where: {
          organizationId: teacher.organizationId,
          subjectId: { in: uniqueIds },
          isEnabled: true,
          subject: { deletedAt: null },
        },
        select: { subjectId: true },
      });

      if (subjectsAll.length !== uniqueIds.length) {
        throw new NotFoundException(
          'Některé zadané předměty neexistují nebo nejsou pro školu povolené.',
        );
      }
    }

    // 5) Mutace (replaceAll / add‑missing)
    if (dto.replaceAll === true) {
      // REPLACE režim – atomicky, ať paralelní požadavky skončí konzistentně
      await this.prisma.$transaction(async (tx) => {
        await tx.teacherSubject.deleteMany({ where: { teacherId } });
        if (uniqueIds.length > 0) {
          await tx.teacherSubject.createMany({
            data: uniqueIds.map((id) => ({ teacherId, subjectId: id })),
            skipDuplicates: true,
          });
        }
      });
    } else {
      // ADD‑MISSING režim – jen doplní chybějící vazby
      if (uniqueIds.length > 0) {
        const existing = await this.prisma.teacherSubject.findMany({
          where: { teacherId, subjectId: { in: uniqueIds } },
          select: { subjectId: true },
        });
        const existingIds = new Set(existing.map((e) => e.subjectId));
        const toAdd = uniqueIds.filter((id) => !existingIds.has(id));
        if (toAdd.length > 0) {
          await this.prisma.teacherSubject.createMany({
            data: toAdd.map((id) => ({ teacherId, subjectId: id })),
            skipDuplicates: true,
          });
        }
      }
    }

    // 6) Audit
    await this.audit({
      userId: user.userId,
      orgId: teacher.organizationId,
      action: dto.replaceAll
        ? 'TEACHER_SUBJECTS_REPLACE'
        : 'TEACHER_SUBJECTS_ADD',
      entityId: teacherId,
      metadata: { subjectIds: uniqueIds, replaceAll: !!dto.replaceAll },
    });

    await this.invalidateTeacherReads(
      cacheScopeForUser(user.systemRole, teacher.organizationId),
      'teachers.assign-subjects',
    );

    // 8) Vrať aktuální stav – přes centrální findOne (musí includovat subjects)
    return this.findOne(teacherId, user);
  }

  /**
   * Odstranění jedné vazby teacher–subject.
   */
  async removeSubject(teacherId: string, subjectId: string, user: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!teacher || teacher.deletedAt)
      throw new NotFoundException('Učitel nebyl nalezen');

    const sameOrg = user.organizationId === teacher.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg &&
          hasAtLeastRole(
            user.organizationRole ?? null,
            OrganizationRole.DIRECTOR,
          ))
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může odebírat předměty.',
      );
    }

    const subject = await this.prisma.orgSubject.findFirst({
      where: {
        organizationId: teacher.organizationId,
        subjectId,
        isEnabled: true,
        subject: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!subject)
      throw new NotFoundException(
        'Předmět neexistuje nebo není pro školu povolený.',
      );

    await this.prisma.teacherSubject.deleteMany({
      where: { teacherId, subjectId },
    });

    await this.audit({
      userId: user.userId,
      orgId: teacher.organizationId,
      action: 'TEACHER_SUBJECT_REMOVE',
      entityId: teacherId,
      metadata: { subjectId },
    });

    const scope = cacheScopeForUser(user.systemRole, teacher.organizationId);
    await this.invalidateTeacherReads(scope, 'teachers.remove-subject');

    return { ok: true };
  }
}
