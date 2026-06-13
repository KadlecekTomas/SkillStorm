import {
  type CanActivate,
  type ExecutionContext,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationStatus } from '@prisma/client';
import { OrgAccessPolicy } from './org-access-policy.service';

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
    private readonly reflector: Reflector,
    private readonly accessPolicy: OrgAccessPolicy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = await this.accessPolicy.resolve(this.reflector, context);
    if (access.allowAny || access.allowPending) return true;

    const orgId = access.orgId;
    if (!orgId) return true;
    if (!access.orgStatus) return true;

    if (access.orgStatus === OrganizationStatus.SUSPENDED) {
      throw new ConflictException({
        message: 'Organization is suspended',
        meta: { code: READINESS_ERROR_CODES.ORG_SUSPENDED },
      });
    }
    if (access.orgStatus === OrganizationStatus.PENDING) {
      throw new ConflictException({
        message: 'Organization is not yet active',
        meta: { code: READINESS_ERROR_CODES.ORG_PENDING },
      });
    }

    const currentCount =
      await this.accessPolicy.countCurrentAcademicYears(orgId);
    if (currentCount === 0) {
      throw new ConflictException({
        message:
          'Current academic year is not configured for this organization.',
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
