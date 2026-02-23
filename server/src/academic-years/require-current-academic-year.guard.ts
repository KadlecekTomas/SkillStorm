import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { RequestWithUser } from '@/types/request-with-user';
import { AcademicYearsService } from './academic-years.service';

/**
 * Ensures the request's organization has exactly one current academic year (isCurrent=true).
 * Used by year-scoped controllers (classrooms, assignments, tests, etc.).
 */
@Injectable()
export class RequireCurrentAcademicYearGuard implements CanActivate {
  constructor(private readonly academicYears: AcademicYearsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req?.user?.organizationId ?? null;
    await this.academicYears.assertOrgHasExactlyOneCurrentYear(orgId);
    return true;
  }
}
