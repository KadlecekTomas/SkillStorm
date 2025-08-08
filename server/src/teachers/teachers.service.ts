import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { QueryTeachersDto } from './dto/query-teachers.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import {
  Prisma,
  AuditEntityType,
  SystemRole,
  OrganizationRole,
} from '@prisma/client';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from 'shared/cache/org-cache.utils';
import { assertSameOrganization } from 'shared/access.utils';
import { AssignSubjectsDto } from './dto/assign-subjects.dto';

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
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ---------- Audit ----------
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, any>;
    changedFields?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
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

  // ---------- Includes (typově bezpečné) ----------
  private teacherListInclude() {
    return Prisma.validator<Prisma.TeacherInclude>()({
      membership: { include: { user: true } },
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

    // povolení: superadmin nebo ředitel té organizace
    const sameOrg = user.organizationId === dto.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR)
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může vytvořit učitele.',
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

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, dto.organizationId),
    );
    return created;
  }

  // ---------- LIST (search + pagination + cache + soft delete) ----------
  async findAll(user: JwtPayload, q: QueryTeachersDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const isSuper = user.systemRole === SystemRole.SUPERADMIN;
    const where: Prisma.TeacherWhereInput = isSuper
      ? { deletedAt: null }
      : { deletedAt: null, organizationId: user.organizationId };

    const t = teacherSearch(q.search);
    if (t) Object.assign(where, t);

    const include = this.teacherListInclude();

    const scopeId = cacheScopeForUser(user.systemRole, user.organizationId);
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'teachers',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search,
      order: [{ membership: { user: { name: 'asc' } } }, { id: 'asc' }],
      filters: null,
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, data] = await this.prisma.$transaction([
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

  // ---------- DETAIL ----------
  async findOne(id: string, user: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: this.teacherDetailInclude(),
    });
    if (!teacher || teacher.deletedAt)
      throw new NotFoundException('Učitel nebyl nalezen');
    assertSameOrganization(teacher.organizationId, user, 'učitel');
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

    // superadmin nebo ředitel dané školy
    const sameOrg = user.organizationId === current.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR)
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může upravit učitele.',
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

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, current.organizationId),
    );
    return updated;
  }

  // ---------- DELETE (soft) ----------
  async remove(id: string, user: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!teacher) throw new NotFoundException('Učitel nebyl nalezen');

    const sameOrg = user.organizationId === teacher.organizationId;
    if (
      !(
        user.systemRole === SystemRole.SUPERADMIN ||
        (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR)
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může smazat učitele.',
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

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, teacher.organizationId),
    );
    return deleted;
  }

  /**
   * Přiřazení předmětů učiteli.
   * - validace: superadmin nebo ředitel stejné školy
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
        (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR)
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může přiřazovat předměty.',
      );
    }

    // validace subjectů a stejné organizace
    const subjects = await this.prisma.subject.findMany({
      where: {
        id: { in: dto.subjectIds },
        organizationId: teacher.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (subjects.length !== dto.subjectIds.length) {
      throw new NotFoundException(
        'Některé zadané předměty neexistují nebo nepatří do stejné organizace.',
      );
    }

    const scopeTeachers = cacheScopeForUser(
      user.systemRole,
      teacher.organizationId,
    );
    const scopeSubjects = scopeTeachers; // stejná org

    if (dto.replaceAll) {
      // replace režim
      await this.prisma.$transaction(async (tx) => {
        await tx.teacherSubject.deleteMany({ where: { teacherId } });
        if (subjects.length > 0) {
          await tx.teacherSubject.createMany({
            data: subjects.map((s) => ({ teacherId, subjectId: s.id })),
            skipDuplicates: true,
          });
        }
      });
    } else {
      // pouze doplnit chybějící
      const existing = await this.prisma.teacherSubject.findMany({
        where: { teacherId, subjectId: { in: dto.subjectIds } },
        select: { subjectId: true },
      });
      const existingIds = new Set(existing.map((e) => e.subjectId));
      const toAdd = subjects.filter((s) => !existingIds.has(s.id));
      if (toAdd.length > 0) {
        await this.prisma.teacherSubject.createMany({
          data: toAdd.map((s) => ({ teacherId, subjectId: s.id })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit({
      userId: user.userId,
      orgId: teacher.organizationId,
      action: dto.replaceAll
        ? 'TEACHER_SUBJECTS_REPLACE'
        : 'TEACHER_SUBJECTS_ADD',
      entityId: teacherId,
      metadata: { subjectIds: dto.subjectIds, replaceAll: !!dto.replaceAll },
    });

    // invalidace listů (teachers & subjects — pro případ UI, které zobrazuje "kteří učitelé učí předmět")
    await bumpOrgVersion(this.cache, scopeTeachers);
    await bumpOrgVersion(this.cache, scopeSubjects);

    // vrať aktuální stav přiřazení
    return this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: this.teacherDetailInclude(),
    });
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
        (sameOrg && user.organizationRole === OrganizationRole.DIRECTOR)
      )
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může odebírat předměty.',
      );
    }

    // ověř, že subject patří do stejné org
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        organizationId: teacher.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!subject)
      throw new NotFoundException(
        'Předmět neexistuje nebo nepatří do stejné organizace.',
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
    await bumpOrgVersion(this.cache, scope); // teachers i subjects sdílí scope

    return { ok: true };
  }
}
