// src/modules/organizations/organizations.service.ts
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  $Enums,
  OrganizationType,
  Prisma,
  AuditEntityType,
} from '@prisma/client';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  getOrgVersion,
} from 'shared/cache/org-cache.utils';

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
    metadata?: Record<string, any> | null;
    orgId?: string | null;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.ORGANIZATION,
        entityId: opts.entityId ?? null,
        action: opts.action,
        metadata: opts.metadata ?? null,
        changedFields: null,
      },
    });
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
      search: q.search,
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
        role: $Enums.OrganizationRole.DIRECTOR,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async create(dto: CreateOrganizationDto, creatorUserId?: string | null) {
    if (dto.name && dto.city) {
      // soft unique hint (nezastavuje create)
      const existing = await this.prisma.organization.findFirst({
        where: { name: dto.name, city: dto.city, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        // volitelně zalogovat warn
      }
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        address: dto.address ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        type: dto.type ?? OrganizationType.SCHOOL,
      },
    });

    if (creatorUserId) {
      await this.prisma.membership.create({
        data: {
          userId: creatorUserId,
          organizationId: org.id,
          role: $Enums.OrganizationRole.DIRECTOR,
        },
      });
    }

    await this.audit({
      userId: creatorUserId ?? null,
      action: 'ORGANIZATION_CREATE',
      entityId: org.id,
      orgId: org.id,
      metadata: { type: org.type },
    });

    await bumpOrgVersion(this.cache, 'ALL'); // invaliduj globální list
    return org;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    byUserId?: string | null,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address ?? undefined,
        city: dto.city ?? undefined,
        country: dto.country ?? undefined,
        type: dto.type ?? undefined,
      },
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
