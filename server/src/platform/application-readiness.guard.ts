import {
  type CanActivate,
  type ExecutionContext,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';

/**
 * Application Readiness Guard – domain invariant enforcement.
 *
 * organization.status is the primary gate. Readiness is NEVER evaluated for non-ACTIVE orgs.
 * - status === SUSPENDED → 409 ORG_SUSPENDED (hard block; check first; never treat as PENDING).
 * - status === PENDING   → 409 ORG_PENDING (awaiting approval).
 * - status === ACTIVE   → apply readiness checks (active year, etc.).
 *
 * SUSPENDED must never be treated as PENDING. No onboarding or repair for SUSPENDED.
 */
export const READINESS_ERROR_CODES = {
  ORG_PENDING: 'ORG_PENDING',
  ORG_SUSPENDED: 'ORG_SUSPENDED',
  NO_CURRENT_ACADEMIC_YEAR: 'NO_CURRENT_ACADEMIC_YEAR',
  MULTIPLE_CURRENT_ACADEMIC_YEARS: 'MULTIPLE_CURRENT_ACADEMIC_YEARS',
  /** @deprecated Use NO_CURRENT_ACADEMIC_YEAR. Kept for one release cycle. */
  NO_ACTIVE_ACADEMIC_YEAR: 'NO_ACTIVE_ACADEMIC_YEAR',
  /** @deprecated Use MULTIPLE_CURRENT_ACADEMIC_YEARS. Kept for one release cycle. */
  MULTIPLE_ACTIVE_ACADEMIC_YEARS: 'MULTIPLE_ACTIVE_ACADEMIC_YEARS',
} as const;

@Injectable()
export class ApplicationReadinessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowAny = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ORG_STATUS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowAny) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req?.user?.organizationId ?? null;
    if (!orgId) return true;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { status: true },
    });
    if (!org) return true;

    if (org.status === OrganizationStatus.SUSPENDED) {
      throw new ConflictException({
        message: 'Organization is suspended',
        meta: { code: READINESS_ERROR_CODES.ORG_SUSPENDED },
      });
    }
    if (org.status === OrganizationStatus.PENDING) {
      throw new ConflictException({
        message: 'Organization is not yet active',
        meta: { code: READINESS_ERROR_CODES.ORG_PENDING },
      });
    }

    const currentCount = await this.prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
    if (currentCount === 0) {
      throw new ConflictException({
        message: 'Current academic year is not configured for this organization.',
        meta: {
          code: READINESS_ERROR_CODES.NO_CURRENT_ACADEMIC_YEAR,
          deprecatedCode: READINESS_ERROR_CODES.NO_ACTIVE_ACADEMIC_YEAR,
        },
      });
    }
    if (currentCount > 1) {
      throw new ConflictException({
        message: 'Multiple academic years are marked as current.',
        meta: {
          code: READINESS_ERROR_CODES.MULTIPLE_CURRENT_ACADEMIC_YEARS,
          deprecatedCode: READINESS_ERROR_CODES.MULTIPLE_ACTIVE_ACADEMIC_YEARS,
        },
      });
    }

    return true;
  }
}
