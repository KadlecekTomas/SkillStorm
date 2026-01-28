// src/modules/classroom/class-sections.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateClassSectionDto } from './dto/create-classroom.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { assertSameOrganization } from '@/shared/access.utils';
import type { UpdateClassroomDto } from './dto/update-classroom.dto';
import type { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import type { SetHomeroomDto } from './dto/set-homeroom.dto';
import { Prisma, OrganizationRole, SystemRole, EnrollmentStatus } from '@prisma/client';
import { hasAtLeastRole } from '@/shared/access.utils';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  buildAuthzScopeKey,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
  bumpOrgVersion,
} from '@/shared/cache/org-cache.utils';
import { AcademicYearsService } from '@/academic-years/academic-years.service';

@Injectable()
export class ClassSectionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly academicYears: AcademicYearsService,
  ) {}

  private async getActiveAcademicYear(orgId: string) {
    const active = await this.prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!active) {
      throw new NotFoundException('Aktivní školní rok nebyl nalezen.');
    }
    return active;
  }

  private getGradeLabel(grade: string): string {
    if (grade.startsWith('GRADE_')) {
      return grade.replace('GRADE_', '');
    }
    if (grade.startsWith('PRIMARY_')) {
      return grade.replace('PRIMARY_', '');
    }
    return grade;
  }

  // -------------------------
  // CREATE
  // -------------------------
  async create(dto: CreateClassSectionDto, user: JwtPayload) {
    if (!user?.organizationId && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Missing organization context.');
    }
    const yearId = dto.yearId ?? dto.academicYearId ?? null;
    if (!yearId) {
      throw new BadRequestException('Chybí školní rok (academicYearId).');
    }
    const year = yearId
      ? await this.prisma.academicYear.findUnique({
          where: { id: yearId },
          select: { id: true, orgId: true, isCurrent: true },
        })
      : null;
    if (yearId && !year)
      throw new NotFoundException('Školní rok nebyl nalezen');
    const resolvedYear = year;
    if (!resolvedYear) {
      throw new NotFoundException('Školní rok nebyl nalezen');
    }
    if (!resolvedYear.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }
    assertSameOrganization(resolvedYear.orgId, user, 'třída');

    const teacherId: string | null = dto.teacherId ?? null;
    if (teacherId) {
      const t = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!t || t.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (t.organizationId !== resolvedYear.orgId)
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
    }

    try {
      const created = await this.prisma.classSection.create({
        data: {
          orgId: resolvedYear.orgId,
          yearId: resolvedYear.id,
          grade: dto.grade,
          section: dto.section,
          label: dto.label ?? `${this.getGradeLabel(dto.grade)}.${dto.section}`,
          teacherId,
          // TODO: Přidat studyField do modelu ClassSection a migrace
        },
      });

      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, resolvedYear.orgId),
      );
      return created; // controller z resultu vytáhne orgId pro invalidaci
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // unikát: @@unique([orgId, yearId, grade, section])
        throw new ConflictException(
          'Třída s tímto ročníkem/sekcí už existuje.',
        );
      }
      throw e;
    }
  }

  // -------------------------
  // LIST
  // -------------------------
  async findAll(q: QueryClassSectionsDto, user: JwtPayload) {
    // validace roku + org
    if (!user?.organizationId && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Missing organization context.');
    }
    const yearId = q.yearId ?? q.academicYearId ?? null;
    if (!yearId) {
      throw new BadRequestException('Chybí školní rok (academicYearId).');
    }
    const year = yearId
      ? await this.prisma.academicYear.findUnique({
          where: { id: yearId },
          select: { id: true, orgId: true },
        })
      : null;
    if (yearId && !year)
      throw new NotFoundException('Školní rok nebyl nalezen');
    const resolvedYear = year;
    if (!resolvedYear) throw new NotFoundException('Školní rok nebyl nalezen');
    assertSameOrganization(resolvedYear.orgId, user, 'třídy');
    await this.academicYears.assertOrgHasExactlyOneActiveYear(resolvedYear.orgId);

    const membership = user.organizationId
      ? await this.prisma.membership.findFirst({
          where: {
            userId: user.userId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
          select: { id: true, role: true },
        })
      : null;
    const role = membership?.role ?? user.organizationRole ?? null;

    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ClassSectionWhereInput = {
      yearId: resolvedYear.id,
      ...(q.grade ? { grade: q.grade } : {}),
      ...(q.search?.trim()
        ? {
            OR: [
              { label: { contains: q.search.trim(), mode: 'insensitive' } },
              { section: { contains: q.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (role === OrganizationRole.TEACHER) {
      const teacher = membership
        ? await this.prisma.teacher.findFirst({
            where: { membershipId: membership.id, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (!teacher) {
        return { data: [], meta: { page, limit, total: 0, pages: 1 } };
      }
      where.teacherId = teacher.id;
    } else if (role === OrganizationRole.STUDENT) {
      const student = membership
        ? await this.prisma.student.findFirst({
            where: { membershipId: membership.id, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (!student) {
        return { data: [], meta: { page, limit, total: 0, pages: 1 } };
      }
      where.enrollments = {
        some: {
          studentId: student.id,
          yearId: resolvedYear.id,
          status: { not: EnrollmentStatus.LEFT },
        },
      };
    } else if (
      role &&
      !hasAtLeastRole(role, OrganizationRole.DIRECTOR) &&
      user.systemRole !== SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException('Access denied.');
    }

    const orderBy: Prisma.ClassSectionOrderByWithRelationInput[] = [
      { grade: 'asc' },
      { section: 'asc' },
      { id: 'asc' },
    ];

    // Per-user cache is mandatory: teacher/student visibility is user-scoped.
    const authzKey = buildAuthzScopeKey({
      userId: user.userId,
      systemRole: user.systemRole,
      organizationRole: role ?? null,
    });

    // org‑scoped verzovaná cache
    const scope = cacheScopeForUser(user.systemRole, resolvedYear.orgId);
    const ver = await getOrgVersion(this.cache, scope);
    const cacheKey = buildVersionedListKey({
      namespace: 'classSections',
      scopeId: scope,
      version: ver,
      authz: authzKey,
      page,
      limit,
      search: q.search ?? '',
      order: orderBy,
      filters: { yearId: resolvedYear.id, grade: q.grade ?? null },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const total = await this.prisma.classSection.count({ where });
      const pages = Math.max(1, Math.ceil(total / limit));

      // Guard: over‑page → prázdná data
      if (skip >= total) {
        return {
          data: [],
          meta: { page, limit, total, pages },
        };
      }

      const data = await this.prisma.classSection.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          teacher: {
            include: {
              membership: {
                select: { user: { select: { name: true, email: true } } },
              },
            },
          },
          enrollments: {
            where: { status: { not: EnrollmentStatus.LEFT } },
            select: { id: true },
          },
          academicYear: { select: { id: true, label: true, isCurrent: true } },
        },
      });

      return {
        data,
        meta: { page, limit, total, pages },
      };
    });
  }

  // -------------------------
  // DETAIL
  // -------------------------
  async findOne(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            membership: { include: { user: true } },
          },
        },
        enrollments: {
          where: { status: { not: EnrollmentStatus.LEFT } },
          include: {
            student: {
              include: { membership: { include: { user: true } } },
            },
          },
        },
        academicYear: { select: { isCurrent: true, id: true, label: true } },
      },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: classSection.orgId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      const role = membership?.role ?? user.organizationRole ?? null;

      if (role === OrganizationRole.TEACHER) {
        const teacher = membership
          ? await this.prisma.teacher.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        if (!teacher || classSection.teacherId !== teacher.id) {
          throw new ForbiddenException('Učitel nemá přístup k této třídě.');
        }
      } else if (role === OrganizationRole.STUDENT) {
        const student = membership
          ? await this.prisma.student.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        const isEnrolled = student
          ? classSection.enrollments.some(
              (enrollment) => enrollment.studentId === student.id,
            )
          : false;
        if (!isEnrolled) {
          throw new ForbiddenException('Student nemá přístup k této třídě.');
        }
      } else if (
        role &&
        !hasAtLeastRole(role, OrganizationRole.DIRECTOR)
      ) {
        throw new ForbiddenException('Access denied.');
      }
    }
    return classSection;
  }

  // -------------------------
  // UPDATE
  // -------------------------
  async update(id: string, dto: UpdateClassroomDto, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      include: { academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');
    assertSameOrganization(classSection.orgId, user, 'třída');
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    let teacherId: string | null | undefined = dto.teacherId;
    if (dto.teacherId !== undefined) {
      teacherId = dto.teacherId ?? null;
      if (teacherId) {
        const t = await this.prisma.teacher.findUnique({
          where: { id: teacherId },
          select: { id: true, organizationId: true, deletedAt: true },
        });
        if (!t || t.deletedAt)
          throw new NotFoundException('Učitel nebyl nalezen.');
        if (t.organizationId !== classSection.orgId)
          throw new ForbiddenException(
            'Učitel není ze stejné organizace jako třída.',
          );
      }
    }

    try {
      const updateData: Prisma.ClassSectionUncheckedUpdateInput = {};
      if (dto.grade !== undefined) {
        updateData.grade = dto.grade;
      }
      if (dto.section !== undefined) {
        updateData.section = dto.section;
      }
      if (dto.label !== undefined) {
        updateData.label = dto.label;
      }
      if (teacherId !== undefined) {
        updateData.teacherId = teacherId;
      }
      // TODO: Přidat studyField do modelu ClassSection a migrace

      const updated = await this.prisma.classSection.update({
        where: { id },
        data: updateData,
      });

      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, classSection.orgId),
      );
      return updated; // controller použije orgId pro invalidaci
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // pokud změna (grade/section/…) narazí na unikát
        throw new ConflictException(
          'Třída s tímto ročníkem/sekcí už existuje.',
        );
      }
      throw e;
    }
  }

  // -------------------------
  // DELETE
  // -------------------------
  async remove(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      select: { id: true, orgId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    const deleted = await this.prisma.classSection.delete({ where: { id } });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, classSection.orgId),
    );
    return deleted;
  }

  async setHomeroom(
    classSectionId: string,
    dto: SetHomeroomDto,
    user: JwtPayload,
  ) {
    const cls = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, teacherId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!cls) throw new NotFoundException('Třída nebyla nalezena.');
    if (!cls.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    const sameOrg = user.organizationId === cls.orgId;
    const isDirector = hasAtLeastRole(
      user.organizationRole ?? null,
      OrganizationRole.DIRECTOR,
    );

    if (
      !(user.systemRole === SystemRole.SUPERADMIN || (sameOrg && isDirector))
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může měnit třídnictví.',
      );
    }

    const teacherId: string | null = dto.teacherId ?? null;

    if (teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!teacher || teacher.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (teacher.organizationId !== cls.orgId) {
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
      }
    }

    const updated = await this.prisma.classSection.update({
      where: { id: classSectionId },
      data: { teacherId },
      include: {
        academicYear: true,
        teacher: { include: { membership: { include: { user: true } } } },
      },
    });

    const scope = cacheScopeForUser(user.systemRole, cls.orgId);
    await bumpOrgVersion(this.cache, scope);

    return updated;
  }
}
