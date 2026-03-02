// src/modules/organizations/organizations.service.ts
import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { Prisma } from '@prisma/client';
import {
  OrganizationType,
  OrganizationStatus,
  AuditEntityType,
  OrganizationRole,
  SchoolGrade,
} from '@prisma/client';
import type { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';
import { getDefaultCzechSchoolYear } from '@/shared/czech-school-year';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // --- audit helper ---
  private async audit(opts: {
    userId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    orgId?: string | null;
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
    await this.prisma.auditLog.create({ data });
  }

  // fulltext nad name/city/country (case-insensitive)
  private orgSearch(
    search?: string,
  ): Prisma.OrganizationWhereInput | undefined {
    const s = search?.trim();
    if (!s) return undefined;
    return {
      OR: [
        { name: { contains: s, mode: 'insensitive' } },
        { city: { contains: s, mode: 'insensitive' } },
        { country: { contains: s, mode: 'insensitive' } },
      ],
    };
  }

  /**
   * List organizations – jen pro SUPERADMIN.
   * Verzovaný scope: 'ALL' (globální seznam).
   */
  async findAll(q: QueryOrganizationsDto) {
    const page = q.page ?? 1;
    const limit = Math.min(200, q.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...(this.orgSearch(q.search) ?? {}),
    };

    const orderBy: Prisma.OrganizationOrderByWithRelationInput[] = [
      { name: 'asc' },
      { id: 'asc' },
    ];

    const scopeId = 'ALL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'organizations',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search ?? '',
      order: orderBy,
      filters: { type: q.type ?? null },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.organization.count({ where }),
        this.prisma.organization.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            country: true,
            type: true,
            createdAt: true,
            deletedAt: true,
          },
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

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');
    return org;
  }

  async userIsDirector(userId: string) {
    if (!userId) return false;
    const count = await this.prisma.membership.count({
      where: {
        userId,
        role: { in: [OrganizationRole.DIRECTOR, OrganizationRole.OWNER] },
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async create(dto: CreateOrganizationDto, creatorUserId?: string | null) {
    if (creatorUserId) {
      const existingOwned = await this.prisma.organization.findFirst({
        where: { ownerUserId: creatorUserId, deletedAt: null },
        select: { id: true },
      });
      if (existingOwned) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ORG_OWNER_LIMIT_REACHED',
          message: 'User can own at most one organization',
        });
      }
    }

    if (dto.name && dto.city) {
      const existing = await this.prisma.organization.findFirst({
        where: { name: dto.name, city: dto.city, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        // soft unique hint (nezastavuje create)
      }
    }

    const type = dto.type ?? OrganizationType.SCHOOL;
    const status =
      type === OrganizationType.SCHOOL
        ? OrganizationStatus.PENDING
        : OrganizationStatus.ACTIVE;

    // Atomic: org + OWNER membership + lastActiveMembershipId. Rollback all if any step fails.
    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: dto.name,
          address: dto.address ?? null,
          city: dto.city ?? null,
          country: dto.country ?? null,
          type,
          status,
          ownerUserId: creatorUserId ?? null,
        },
      });

      if (creatorUserId) {
        const membership = await tx.membership.create({
          data: {
            userId: creatorUserId,
            organizationId: created.id,
            role: OrganizationRole.OWNER,
          },
        });
        await tx.user.update({
          where: { id: creatorUserId },
          data: { lastActiveMembershipId: membership.id },
        });
      }

      return created;
    });

    await this.audit({
      userId: creatorUserId ?? null,
      action: 'ORGANIZATION_CREATE',
      entityId: org.id,
      orgId: org.id,
      metadata: { type: org.type },
    });

    // Invariant: every organization has exactly one active academic year.
    const existingActive = await this.prisma.academicYear.findFirst({
      where: { orgId: org.id, isCurrent: true },
      select: { id: true },
    });
    if (!existingActive) {
      const { startDate, endDate, label } = getDefaultCzechSchoolYear();
      await this.prisma.academicYear.create({
        data: {
          orgId: org.id,
          label,
          startsAt: startDate,
          endsAt: endDate,
          isCurrent: true,
        },
      });
    }

    // Invariant: every new organization gets a Subject record for each CatalogSubject.
    await this.provisionDefaultSubjects(org.id);

    await bumpOrgVersion(this.cache, 'ALL'); // invaliduj globální list
    return org;
  }

  /**
   * Idempotently creates one Subject + one SubjectLevel per SchoolGrade per CatalogSubject for the org.
   * Safe to call multiple times — all operations are upserts (update: {} → no-op when already exists).
   */
  private async provisionDefaultSubjects(orgId: string): Promise<void> {
    const grades = Object.values(SchoolGrade);
    await this.prisma.$transaction(async (tx) => {
      const catalogSubjects = await tx.catalogSubject.findMany({ orderBy: { name: 'asc' } });
      for (const catalog of catalogSubjects) {
        const subject = await tx.subject.upsert({
          where: {
            organizationId_catalogSubjectId: {
              organizationId: orgId,
              catalogSubjectId: catalog.id,
            },
          },
          update: {},
          create: {
            organizationId: orgId,
            catalogSubjectId: catalog.id,
            name: catalog.name,
          },
        });
        for (const grade of grades) {
          await tx.subjectLevel.upsert({
            where: { subjectId_grade: { subjectId: subject.id, grade } },
            update: {},
            create: { subjectId: subject.id, grade, order: null, label: null },
          });
        }
      }
    });
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    byUserId?: string | null,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');

    const data: Prisma.OrganizationUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.type !== undefined) data.type = dto.type;

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
    });

    await this.audit({
      userId: byUserId ?? null,
      action: 'ORGANIZATION_UPDATE',
      entityId: id,
      orgId: id,
      metadata: { changed: Object.keys(dto ?? {}) },
    });

    await bumpOrgVersion(this.cache, 'ALL');
    return updated;
  }

  async remove(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    // Soft delete: auditní stopa organizace a její historie musí zůstat čitelná.
    const deleted = await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit({
      action: 'ORGANIZATION_DELETE_SOFT',
      entityId: id,
      orgId: id,
      userId: null,
      metadata: null,
    });

    await bumpOrgVersion(this.cache, 'ALL');
    return deleted;
  }
}
