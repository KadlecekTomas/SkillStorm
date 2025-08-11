// src/modules/class-section/classroom.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import { assertSameOrganization } from 'shared/access.utils';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { Prisma } from '@prisma/client';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
  bumpOrgVersion,
} from 'shared/cache/org-cache.utils';

@Injectable()
export class ClassroomService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // -------------------------
  // CREATE
  // -------------------------
  async create(dto: CreateClassSectionDto, user: JwtPayload) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: dto.yearId },
      select: { orgId: true },
    });
    if (!year) throw new NotFoundException('Školní rok nebyl nalezen');
    assertSameOrganization(year.orgId, user, 'třída');

    const teacherId: string | null = dto.teacherId ?? null;
    if (teacherId) {
      const t = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!t || t.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (t.organizationId !== year.orgId)
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
    }

    try {
      const created = await this.prisma.classSection.create({
        data: {
          orgId: year.orgId,
          yearId: dto.yearId,
          grade: dto.grade,
          section: dto.section,
          label: dto.label ?? null,
          teacherId,
          // TODO: Přidat studyField do modelu ClassSection a migrace
        },
      });

      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, year.orgId),
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
    const year = await this.prisma.academicYear.findUnique({
      where: { id: q.yearId },
      select: { orgId: true },
    });
    if (!year) throw new NotFoundException('Školní rok nebyl nalezen');
    assertSameOrganization(year.orgId, user, 'třídy');

    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ClassSectionWhereInput = {
      yearId: q.yearId,
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

    const orderBy: Prisma.ClassSectionOrderByWithRelationInput[] = [
      { grade: 'asc' },
      { section: 'asc' },
      { id: 'asc' },
    ];

    // org‑scoped verzovaná cache
    const scope = cacheScopeForUser(user.systemRole, year.orgId);
    const ver = await getOrgVersion(this.cache, scope);
    const cacheKey = buildVersionedListKey({
      namespace: 'classSections',
      scopeId: scope,
      version: ver,
      page,
      limit,
      search: q.search,
      order: orderBy,
      filters: { yearId: q.yearId, grade: q.grade ?? null },
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
          enrollments: true,
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
        enrollments: true,
      },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    return classSection;
  }

  // -------------------------
  // UPDATE
  // -------------------------
  async update(id: string, dto: UpdateClassroomDto, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');
    assertSameOrganization(classSection.orgId, user, 'třída');

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
      const updated = await this.prisma.classSection.update({
        where: { id },
        data: {
          grade: dto.grade ?? undefined,
          section: dto.section ?? undefined,
          label: dto.label ?? undefined,
          teacherId, // může být undefined / null / uuid
          // TODO: Přidat studyField do modelu ClassSection a migrace
        },
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
      select: { id: true, orgId: true },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');

    const deleted = await this.prisma.classSection.delete({ where: { id } });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, classSection.orgId),
    );
    return deleted;
  }
}
