import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { assertOrgReady } from '@/shared/org-readiness.utils';

export type PlatformOrgListDto = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  ownerEmail: string | null;
  membershipsCount: number;
  studentsCount: number;
  classroomsCount: number;
  hasActiveAcademicYear: boolean;
  hasAnyClassSectionInActiveYear: boolean;
};

export type PlatformOrgDetailDto = PlatformOrgListDto & {
  lastActivityAt: Date | null;
};

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations(q: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: PlatformOrgListDto[]; meta: { page: number; limit: number; total: number; pages: number } }> {
    const page = q.page ?? 1;
    const limit = Math.min(100, q.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
    };
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { owner: { email: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

    const items: PlatformOrgListDto[] = [];
    for (const o of orgs) {
      const activeYearId = o.academicYears[0]?.id ?? null;
      let hasAnyClassSectionInActiveYear = false;
      if (activeYearId) {
        const count = await this.prisma.classSection.count({
          where: { yearId: activeYearId },
        });
        hasAnyClassSectionInActiveYear = count > 0;
      }
      items.push({
        id: o.id,
        name: o.name,
        status: o.status,
        createdAt: o.createdAt,
        ownerEmail: o.owner?.email ?? null,
        membershipsCount: o._count.memberships,
        studentsCount: o._count.students,
        classroomsCount: o._count.classSections,
        hasActiveAcademicYear: activeYearId !== null,
        hasAnyClassSectionInActiveYear,
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

    const activeYearId = org.academicYears[0]?.id ?? null;
    let hasAnyClassSectionInActiveYear = false;
    if (activeYearId) {
      const count = await this.prisma.classSection.count({
        where: { yearId: activeYearId },
      });
      hasAnyClassSectionInActiveYear = count > 0;
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
      membershipsCount: org._count.memberships,
      studentsCount: org._count.students,
      classroomsCount: org._count.classSections,
      hasActiveAcademicYear: activeYearId !== null,
      hasAnyClassSectionInActiveYear,
      lastActivityAt: lastSub?.submittedAt ?? null,
    };
  }

  async suspend(id: string): Promise<{ status: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    await this.prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.SUSPENDED },
    });
    return { status: OrganizationStatus.SUSPENDED };
  }

  async reactivate(id: string): Promise<{ status: string }> {
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
      return { status: OrganizationStatus.PENDING };
    }
    await this.prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    return { status: OrganizationStatus.ACTIVE };
  }
}
