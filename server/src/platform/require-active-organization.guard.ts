import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationStatus } from '@prisma/client';
import { ORG_SUSPENDED, ORG_PENDING } from '@/shared/org-readiness.utils';
import { OrgAccessPolicy } from './org-access-policy.service';

/**
 * Domain rule: organization.status is the SINGLE source of truth for OWNER accessibility.
 * PENDING and SUSPENDED are distinct; never treat SUSPENDED as "pending approval".
 *
 * - status === SUSPENDED → 403 ORG_SUSPENDED (SUSPENDED must be checked before PENDING).
 * - status === PENDING   → 403 ORG_PENDING (awaiting initial SUPERADMIN approval).
 * - status === ACTIVE    → allow (readiness enforced elsewhere when applicable).
 */
@Injectable()
export class RequireActiveOrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessPolicy: OrgAccessPolicy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = await this.accessPolicy.resolve(this.reflector, context);
    if (access.allowAny || access.allowPending) return true;

    const orgId = access.orgId;
    if (!orgId) return true; // no org context – let other guards handle
    if (!access.orgStatus) return true;

    if (access.orgStatus === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ORG_SUSPENDED,
        message: 'Organization is suspended',
      });
    }
    if (access.orgStatus === OrganizationStatus.PENDING) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ORG_PENDING,
        message: 'Organization is not yet active',
      });
    }
    return true;
  }
}
