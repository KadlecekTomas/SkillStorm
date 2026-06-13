// src/modules/organizations/organizations.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  Prisma,
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
import { createHash } from 'crypto';

export const ORG_OWNER_LIMIT_REACHED = 'ORG_OWNER_LIMIT_REACHED';
export const ORG_CREATE_IDEMPOTENCY_KEY_REUSED =
  'ORG_CREATE_IDEMPOTENCY_KEY_REUSED';
const CREATE_ORGANIZATION_OPERATION = 'create_organization';
const SUPPORTED_CREATE_ORGANIZATION_TYPES = new Set<OrganizationType>([
  OrganizationType.SCHOOL,
]);

type CreateOrganizationTestOptions = {
  failBeforeAcademicYear?: boolean;
};

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

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

  private normalizeIdempotencyKey(
    idempotencyKey?: string | null,
  ): string | null {
    const normalized = idempotencyKey?.trim() ?? '';
    return normalized.length > 0 ? normalized.slice(0, 255) : null;
  }

  private buildCreateRequestHash(dto: CreateOrganizationDto): string {
    const normalized = JSON.stringify({
      name: dto.name?.trim() ?? '',
      address: dto.address?.trim() ?? '',
      city: dto.city?.trim() ?? '',
      country: dto.country?.trim() ?? '',
      type: dto.type ?? OrganizationType.SCHOOL,
    });
    return createHash('sha256').update(normalized).digest('hex');
  }

  private async findExistingIdempotentOrganization(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        userId_operation_key: {
          userId,
          operation: CREATE_ORGANIZATION_OPERATION,
          key: idempotencyKey,
        },
      },
    });

    if (!existing) return null;
    if (existing.requestHash !== requestHash) {
      throw new ConflictException({
        statusCode: 409,
        code: ORG_CREATE_IDEMPOTENCY_KEY_REUSED,
        message:
          'Idempotency-Key was already used with a different create-organization payload.',
      });
    }
    if (existing.result && typeof existing.result === 'object') {
      const result = existing.result as Record<string, unknown>;
      if (typeof result.id === 'string') {
        return result;
      }
    }
    return null;
  }

  private async waitForExistingIdempotentOrganization(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    attempts = 8,
    delayMs = 50,
  ) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const existing = await this.findExistingIdempotentOrganization(
        userId,
        idempotencyKey,
        requestHash,
      );
      if (existing) {
        return existing;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  private buildCreateOrganizationResult(org: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    type: OrganizationType;
    status: OrganizationStatus;
    ownerUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: org.id,
      name: org.name,
      address: org.address,
      city: org.city,
      country: org.country,
      type: org.type,
      status: org.status,
      ownerUserId: org.ownerUserId,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      deletedAt: org.deletedAt,
    };
  }

  async create(
    dto: CreateOrganizationDto,
    creatorUserId?: string | null,
    idempotencyKey?: string | null,
    testOptions?: CreateOrganizationTestOptions,
  ) {
    const normalizedIdempotencyKey =
      this.normalizeIdempotencyKey(idempotencyKey);
    const requestHash = this.buildCreateRequestHash(dto);

    if (creatorUserId && normalizedIdempotencyKey) {
      const existing = await this.findExistingIdempotentOrganization(
        creatorUserId,
        normalizedIdempotencyKey,
        requestHash,
      );
      if (existing) {
        return existing;
      }
    }

    if (creatorUserId && !normalizedIdempotencyKey) {
      const existingOwned = await this.prisma.organization.findFirst({
        where: { ownerUserId: creatorUserId, deletedAt: null },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          country: true,
          type: true,
          status: true,
          ownerUserId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });
      if (existingOwned) {
        throw new ConflictException({
          statusCode: 409,
          code: ORG_OWNER_LIMIT_REACHED,
          message: 'User can own at most one organization',
        });
      }
    }

    const type = dto.type ?? OrganizationType.SCHOOL;
    if (!SUPPORTED_CREATE_ORGANIZATION_TYPES.has(type)) {
      throw new BadRequestException(
        'Typ organizace zatím není podporován. Momentálně lze vytvořit pouze školu.',
      );
    }
    const status =
      type === OrganizationType.SCHOOL
        ? OrganizationStatus.PENDING
        : OrganizationStatus.ACTIVE;

    let org;
    try {
      org = await this.prisma.$transaction(async (tx) => {
        if (creatorUserId && normalizedIdempotencyKey) {
          await tx.idempotencyKey.create({
            data: {
              userId: creatorUserId,
              key: normalizedIdempotencyKey,
              operation: CREATE_ORGANIZATION_OPERATION,
              requestHash,
            },
          });
        }

        if (creatorUserId) {
          const existingOwned = await tx.organization.findFirst({
            where: { ownerUserId: creatorUserId, deletedAt: null },
            select: { id: true },
          });
          if (existingOwned) {
            throw new ConflictException({
              statusCode: 409,
              code: ORG_OWNER_LIMIT_REACHED,
              message: 'User can own at most one organization',
            });
          }
        }

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

        const auditData: Prisma.AuditLogUncheckedCreateInput = {
          userId: creatorUserId ?? null,
          organizationId: created.id,
          entityType: AuditEntityType.ORGANIZATION,
          entityId: created.id,
          action: 'ORGANIZATION_CREATE',
          metadata: { type: created.type } as Prisma.InputJsonValue,
        };
        await tx.auditLog.create({ data: auditData });

        if (testOptions?.failBeforeAcademicYear) {
          throw new Error(
            'Simulated bootstrap failure before academic year creation',
          );
        }

        const { startDate, endDate, label } = getDefaultCzechSchoolYear();
        await tx.academicYear.create({
          data: {
            orgId: created.id,
            label,
            startsAt: startDate,
            endsAt: endDate,
            isCurrent: true,
          },
        });

        await this.provisionDefaultSubjects(tx, created.id);

        if (creatorUserId && normalizedIdempotencyKey) {
          await tx.idempotencyKey.update({
            where: {
              userId_operation_key: {
                userId: creatorUserId,
                operation: CREATE_ORGANIZATION_OPERATION,
                key: normalizedIdempotencyKey,
              },
            },
            data: {
              result: this.buildCreateOrganizationResult(
                created,
              ) as Prisma.InputJsonValue,
            },
          });
        }

        return created;
      });
    } catch (error) {
      if (
        creatorUserId &&
        normalizedIdempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.waitForExistingIdempotentOrganization(
          creatorUserId,
          normalizedIdempotencyKey,
          requestHash,
        );
        if (existing) {
          return existing;
        }
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.map(String)
          : [];
        const isOwnerLimitConflict = target.some(
          (item) =>
            item.includes('owner_user_id') || item.includes('ownerUserId'),
        );
        if (!isOwnerLimitConflict) {
          throw error;
        }
        throw new ConflictException({
          statusCode: 409,
          code: ORG_OWNER_LIMIT_REACHED,
          message: 'User can own at most one organization',
        });
      }
      throw error;
    }

    await bumpOrgVersion(this.cache, 'ALL').catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to bump org cache version: ${message}`);
    });
    return org;
  }

  /**
   * Idempotently enables catalog subjects for the org and ensures shared
   * SubjectLevel rows exist on the global Subject catalog.
   */
  private async provisionDefaultSubjects(
    tx: Prisma.TransactionClient,
    orgId: string,
  ): Promise<void> {
    const grades = Object.values(SchoolGrade);
    const catalogSubjects = await tx.catalogSubject.findMany({
      orderBy: { name: 'asc' },
    });
    for (const catalog of catalogSubjects) {
      const subject = await tx.subject.upsert({
        where: { catalogSubjectId: catalog.id },
        update: {},
        create: {
          catalogSubjectId: catalog.id,
          name: catalog.name,
          gradeFrom: 1,
          gradeTo: 9,
        },
      });
      await tx.orgSubject.upsert({
        where: {
          organizationId_subjectId: {
            organizationId: orgId,
            subjectId: subject.id,
          },
        },
        update: { isEnabled: true },
        create: {
          organizationId: orgId,
          subjectId: subject.id,
          isEnabled: true,
          isCustom: false,
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
