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
 * Application Readiness Guard – domain invariant enforcement (system-level consistency).
 *
 * Domain endpoints MUST NOT run unless the application is in READY state.
 * READY = organization.status === ACTIVE && exactly one AcademicYear with isCurrent === true.
 *
 * This is NOT a UI workaround: backend and frontend together enforce the invariant
 * "invalid application state must NOT be shown to the user". This guard returns
 * structured 409 (never 403) so the frontend can show the correct state screen.
 */
export const READINESS_ERROR_CODES = {
  ORG_PENDING: 'ORG_PENDING',
  ORG_SUSPENDED: 'ORG_SUSPENDED',
  NO_ACTIVE_ACADEMIC_YEAR: 'NO_ACTIVE_ACADEMIC_YEAR',
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

    if (org.status === OrganizationStatus.PENDING) {
      throw new ConflictException({
        message: 'Organization is not yet active',
        meta: { code: READINESS_ERROR_CODES.ORG_PENDING },
      });
    }
    if (org.status === OrganizationStatus.SUSPENDED) {
      throw new ConflictException({
        message: 'Organization is suspended',
        meta: { code: READINESS_ERROR_CODES.ORG_SUSPENDED },
      });
    }

    const activeCount = await this.prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
    if (activeCount === 0) {
      throw new ConflictException({
        message: 'Active academic year is not configured for this organization.',
        meta: { code: READINESS_ERROR_CODES.NO_ACTIVE_ACADEMIC_YEAR },
      });
    }
    if (activeCount > 1) {
      throw new ConflictException({
        message: 'Multiple academic years are marked as active.',
        meta: { code: READINESS_ERROR_CODES.MULTIPLE_ACTIVE_ACADEMIC_YEARS },
      });
    }

    return true;
  }
}
