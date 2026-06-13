import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConflictException, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';

export const ACADEMIC_YEAR_EXPIRED = 'ACADEMIC_YEAR_EXPIRED';

/**
 * Blocks write operations (non-GET) when the active academic year has expired
 * (today > activeYear.endsAt) for TEACHER and STUDENT roles.
 *
 * Directors and Owners are always allowed through — they must be able to
 * create the next academic year even when the current one has expired.
 *
 * Does NOT depend on OrgContextService to avoid a circular dependency:
 *   OrgContextModule → AcademicYearsModule → OrgContextService
 * Instead it reads organizationRole from the JWT payload directly,
 * and calls AcademicYearsService only for non-director users.
 *
 * Usage: @UseGuards(JwtAuthGuard, AcademicYearExpiredGuard)
 */
@Injectable()
export class AcademicYearExpiredGuard implements CanActivate {
  constructor(
    private readonly academicYears: AcademicYearsService,
    private readonly yearCache: AcademicYearCacheRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    // Only guard mutating requests — reads are always safe.
    if (
      req.method === 'GET' ||
      req.method === 'HEAD' ||
      req.method === 'OPTIONS'
    ) {
      return true;
    }

    const { organizationId, organizationRole } = req.user ?? {};
    if (!organizationId) return true;

    // Directors and Owners can always write — e.g. POST /academic-years to create next year.
    if (
      organizationRole === OrganizationRole.DIRECTOR ||
      organizationRole === OrganizationRole.OWNER
    ) {
      return true;
    }

    // Fast path: if cache is warm and the year is not yet expired, skip the DB call entirely.
    // This avoids a round-trip on every teacher/student write request.
    const cached = this.yearCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.endsAt) return true; // no year configured — let RequireCurrentAcademicYearGuard handle
      if (Date.now() <= cached.endsAt.getTime()) return true; // year still valid
      // Year is expired per cache — fall through to fetch name for error message.
    }

    // For everyone else (TEACHER, STUDENT), check if the current year has expired.
    let year: { endDate: Date; name: string };
    try {
      year = await this.academicYears.getCurrentForOrgOrFail(organizationId);
    } catch {
      // No current year configured — let RequireCurrentAcademicYearGuard handle it.
      return true;
    }

    if (Date.now() > year.endDate.getTime()) {
      throw new ConflictException({
        statusCode: 409,
        code: ACADEMIC_YEAR_EXPIRED,
        message:
          'Školní rok vypršel. Kontaktujte vedení školy pro vytvoření nového roku.',
        expiredYear: year.name,
      });
    }

    return true;
  }
}
