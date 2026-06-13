import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import type { OrgContext } from './org-context.types';

const YEAR_CACHE_TTL_MS = 45_000;

@Injectable()
export class OrgContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicYears: AcademicYearsService,
    private readonly yearCache: AcademicYearCacheRef,
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
    const { yearId, endsAt } = await this.getActiveYearData(organizationId);
    const isAcademicYearExpired = endsAt
      ? Date.now() > endsAt.getTime()
      : false;

    return {
      organizationId,
      membershipId: membership.id,
      role: membership.role,
      activeAcademicYearId: yearId,
      isAcademicYearExpired,
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
      throw new ForbiddenException(
        'Active membership not found in organization.',
      );
    }
    return fallback;
  }

  private async getActiveYearData(
    organizationId: string,
  ): Promise<{ yearId: string | null; endsAt: Date | null }> {
    const now = Date.now();
    const cached = this.yearCache.get(organizationId);
    if (cached && cached.expiresAt > now) {
      return { yearId: cached.yearId, endsAt: cached.endsAt };
    }

    try {
      const year =
        await this.academicYears.getCurrentForOrgOrFail(organizationId);
      this.yearCache.set(organizationId, {
        yearId: year.id,
        endsAt: year.endDate,
        expiresAt: now + YEAR_CACHE_TTL_MS,
      });
      return { yearId: year.id, endsAt: year.endDate };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      return { yearId: null, endsAt: null };
    }
  }

  /** @deprecated Use getActiveYearData internally; kept for any external callers. */
  async getActiveAcademicYearId(
    organizationId: string,
  ): Promise<string | null> {
    const { yearId } = await this.getActiveYearData(organizationId);
    return yearId;
  }

  invalidateOrgYearCache(organizationId: string): void {
    this.yearCache.invalidate(organizationId);
  }

  hasTeacherLevelRole(ctx: OrgContext): boolean {
    return (
      ctx.role === OrganizationRole.TEACHER ||
      ctx.role === OrganizationRole.DIRECTOR ||
      ctx.role === OrganizationRole.OWNER
    );
  }
}
