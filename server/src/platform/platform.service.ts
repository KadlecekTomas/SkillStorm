import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditEntityType, OrganizationStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { assertOrgReady } from '@/shared/org-readiness.utils';
import { AuditService } from '@/audit/audit.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';

/**
 * Internal DTO returned from listPlatformUsers.
 * Contains `anonymized` for GDPR scoping — NEVER serialize this directly.
 * Always pass through PlatformDataScopeService.scopeUsers() first.
 */
export type PlatformUserInternal = {
  id: string;
  name: string;
  email: string | null;
  systemRole: string | null;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  anonymized: boolean;
};

export type PlatformOrgListDto = {
  id: string;
  name: string;
  /** Authoritative platform status – PENDING | ACTIVE | SUSPENDED. */
  status: OrganizationStatus;
  createdAt: Date;
  ownerEmail: string | null;
  membershipsCount: number;
  studentsCount: number;
  classroomsCount: number;
  hasCurrentAcademicYear: boolean;
  hasAnyClassSectionInCurrentYear: boolean;
  /** @deprecated Use hasCurrentAcademicYear. Same value, kept for one release. */
  hasActiveAcademicYear?: boolean;
  /** @deprecated Use hasAnyClassSectionInCurrentYear. Same value, kept for one release. */
  hasAnyClassSectionInActiveYear?: boolean;
};

export type PlatformOrgDetailDto = PlatformOrgListDto & {
  lastActivityAt: Date | null;
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async listPlatformUsers(input: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    items: PlatformUserInternal[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { page, limit } = input;
    const search = input.search?.trim();
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          anonymized: true,
        },
      }),
    ]);

    return {
      items: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        systemRole: u.systemRole,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        anonymized: u.anonymized,
      })),
      meta: { total, page, limit },
    };
  }

  async listOrganizations(q: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: PlatformOrgListDto[];
    meta: { page: number; limit: number; total: number; pages: number };
  }> {
    const page = q.page ?? 1;
    const limit = Math.min(100, q.limit ?? 20);
    const skip = (page - 1) * limit;
    const search = q.search?.trim() ?? '';

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { owner: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Domain-driven ordering:
    // – PENDING organizations are a processing queue (oldest first)
    // – ACTIVE/SUSPENDED are informational only (newest first)
    // – Sorting is fixed intentionally to avoid admin decision fatigue
    const orderedIds = search
      ? await this.prisma.$queryRaw<[{ organization_id: string }]>`
          SELECT o.organization_id
          FROM organizations o
          LEFT JOIN users u ON u.user_id = o.owner_user_id
          WHERE o.deleted_at IS NULL
            AND (o.name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})
          ORDER BY
            CASE o.status WHEN 'PENDING' THEN 1 WHEN 'ACTIVE' THEN 2 WHEN 'SUSPENDED' THEN 3 END,
            CASE WHEN o.status = 'PENDING' THEN o.created_at END ASC NULLS LAST,
            CASE WHEN o.status != 'PENDING' THEN o.created_at END DESC NULLS LAST
          LIMIT ${limit}
          OFFSET ${skip}
        `
      : await this.prisma.$queryRaw<[{ organization_id: string }]>`
          SELECT organization_id
          FROM organizations
          WHERE deleted_at IS NULL
          ORDER BY
            CASE status WHEN 'PENDING' THEN 1 WHEN 'ACTIVE' THEN 2 WHEN 'SUSPENDED' THEN 3 END,
            CASE WHEN status = 'PENDING' THEN created_at END ASC NULLS LAST,
            CASE WHEN status != 'PENDING' THEN created_at END DESC NULLS LAST
          LIMIT ${limit}
          OFFSET ${skip}
        `;

    const idList = orderedIds.map((r) => r.organization_id);
    if (idList.length === 0) {
      const total = await this.prisma.organization.count({ where });
      return {
        items: [],
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where: { id: { in: idList }, deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          owner: { select: { email: true } },
          _count: {
            select: { memberships: true, students: true, classSections: true },
          },
          academicYears: {
            where: { isCurrent: true },
            select: { id: true },
          },
        },
      }),
    ]);

    const byId = new Map(orgs.map((o) => [o.id, o]));
    const currentYearIds = orgs
      .map((org) => org.academicYears[0]?.id ?? null)
      .filter((yearId): yearId is string => Boolean(yearId));
    const classCountsByYear = currentYearIds.length
      ? new Map(
          (
            await this.prisma.classSection.groupBy({
              by: ['yearId'],
              where: { yearId: { in: currentYearIds } },
              _count: { _all: true },
            })
          ).map((group) => [group.yearId, group._count._all]),
        )
      : new Map<string, number>();
    const items: PlatformOrgListDto[] = [];
    for (const id of idList) {
      const o = byId.get(id);
      if (!o) continue;
      const currentYearId = o.academicYears[0]?.id ?? null;
      const hasAnyClassSectionInCurrentYear = currentYearId
        ? (classCountsByYear.get(currentYearId) ?? 0) > 0
        : false;
      items.push({
        id: o.id,
        name: o.name,
        status: o.status,
        createdAt: o.createdAt,
        ownerEmail: o.owner?.email ?? null,
        membershipsCount: o._count?.memberships ?? 0,
        studentsCount: o._count?.students ?? 0,
        classroomsCount: o._count?.classSections ?? 0,
        hasCurrentAcademicYear: currentYearId !== null,
        hasAnyClassSectionInCurrentYear,
        hasActiveAcademicYear: currentYearId !== null,
        hasAnyClassSectionInActiveYear: hasAnyClassSectionInCurrentYear,
      });
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getOrganizationDetail(id: string): Promise<PlatformOrgDetailDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        owner: { select: { email: true } },
        _count: {
          select: { memberships: true, students: true, classSections: true },
        },
        academicYears: {
          where: { isCurrent: true },
          select: { id: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const currentYearId = org.academicYears[0]?.id ?? null;
    let hasAnyClassSectionInCurrentYear = false;
    if (currentYearId) {
      const count = await this.prisma.classSection.count({
        where: { yearId: currentYearId },
      });
      hasAnyClassSectionInCurrentYear = count > 0;
    }

    const lastSub = await this.prisma.submission.findFirst({
      where: { assignment: { organizationId: org.id } },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });

    return {
      id: org.id,
      name: org.name,
      status: org.status,
      createdAt: org.createdAt,
      ownerEmail: org.owner?.email ?? null,
      membershipsCount: org._count?.memberships ?? 0,
      studentsCount: org._count?.students ?? 0,
      classroomsCount: org._count?.classSections ?? 0,
      hasCurrentAcademicYear: currentYearId !== null,
      hasAnyClassSectionInCurrentYear,
      hasActiveAcademicYear: currentYearId !== null,
      hasAnyClassSectionInActiveYear: hasAnyClassSectionInCurrentYear,
      lastActivityAt: lastSub?.submittedAt ?? null,
    };
  }

  /**
   * Approve organization (PENDING → ACTIVE).
   * Returns full, updated organization snapshot for SUPERADMIN UI.
   */
  async activate(id: string, userId: string): Promise<PlatformOrgDetailDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== OrganizationStatus.PENDING) {
      throw new BadRequestException(
        'Only organizations with status PENDING can be activated',
      );
    }

    await this.prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    await this.academicYearsService.createDefaultAcademicYearIfMissing(id);
    await this.auditService.log({
      action: 'ORG_APPROVED',
      entityType: AuditEntityType.ORGANIZATION,
      entityId: id,
      userId,
      organizationId: id,
    });

    // Return authoritative, fully-populated organization object.
    return this.getOrganizationDetail(id);
  }

  /**
   * Suspend organization.
   * Returns full, updated organization snapshot for SUPERADMIN UI.
   */
  async suspend(id: string): Promise<PlatformOrgDetailDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    await this.prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.SUSPENDED },
    });

    return this.getOrganizationDetail(id);
  }

  /**
   * Reactivate organization.
   * If organization is not ready, status becomes PENDING; otherwise ACTIVE.
   * Always returns full, updated organization snapshot for SUPERADMIN UI.
   */
  async reactivate(id: string): Promise<PlatformOrgDetailDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    try {
      await assertOrgReady(this.prisma, org.id);
    } catch {
      await this.prisma.organization.update({
        where: { id },
        data: { status: OrganizationStatus.PENDING },
      });
      return this.getOrganizationDetail(id);
    }
    await this.prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    return this.getOrganizationDetail(id);
  }
}
