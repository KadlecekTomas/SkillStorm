import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { RequestWithUser } from '@/types/request-with-user';
import { AcademicYearsService } from './academic-years.service';

@Injectable()
export class RequireActiveAcademicYearGuard implements CanActivate {
  constructor(private readonly academicYears: AcademicYearsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req?.user?.organizationId ?? null;
    await this.academicYears.assertOrgHasExactlyOneActiveYear(orgId);
    return true;
  }
}
