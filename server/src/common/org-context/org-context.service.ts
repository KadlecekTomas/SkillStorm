import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import type { OrgContext } from './org-context.types';

type CachedYear = {
  yearId: string | null;
  expiresAt: number;
};

const YEAR_CACHE_TTL_MS = 45_000;

@Injectable()
export class OrgContextService {
  private readonly activeYearCache = new Map<string, CachedYear>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicYears: AcademicYearsService,
  ) {}

  async get(req: RequestWithUser): Promise<OrgContext> {
    return this.getForUser(req.user);
  }

  async getForUser(user: JwtPayload): Promise<OrgContext> {
    const organizationId = user.organizationId ?? null;
    if (!organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }

    const membership = await this.resolveMembership(user, organizationId);
    const activeAcademicYearId = await this.getActiveAcademicYearId(organizationId);

    return {
      organizationId,
      membershipId: membership.id,
      role: membership.role,
      activeAcademicYearId,
    };
  }

  private async resolveMembership(user: JwtPayload, organizationId: string) {
    if (user.membershipId) {
      const byId = await this.prisma.membership.findFirst({
        where: {
          id: user.membershipId,
          userId: user.userId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      if (byId) return byId;
    }

    const fallback = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, role: true },
    });
    if (!fallback) {
      throw new ForbiddenException('Active membership not found in organization.');
    }
    return fallback;
  }

  private async getActiveAcademicYearId(
    organizationId: string,
  ): Promise<string | null> {
    const now = Date.now();
    const cached = this.activeYearCache.get(organizationId);
    if (cached && cached.expiresAt > now) {
      return cached.yearId;
    }

    try {
      const year = await this.academicYears.getCurrentForOrgOrFail(organizationId);
      this.activeYearCache.set(organizationId, {
        yearId: year.id,
        expiresAt: now + YEAR_CACHE_TTL_MS,
      });
      return year.id;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.activeYearCache.set(organizationId, {
        yearId: null,
        expiresAt: now + YEAR_CACHE_TTL_MS,
      });
      return null;
    }
  }

  invalidateOrgYearCache(organizationId: string): void {
    this.activeYearCache.delete(organizationId);
  }

  hasTeacherLevelRole(ctx: OrgContext): boolean {
    return (
      ctx.role === OrganizationRole.TEACHER ||
      ctx.role === OrganizationRole.DIRECTOR ||
      ctx.role === OrganizationRole.OWNER
    );
  }
}
