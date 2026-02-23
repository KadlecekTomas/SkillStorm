import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationStatus } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import { ORG_SUSPENDED, ORG_PENDING } from '@/shared/org-readiness.utils';
import { ALLOW_PENDING_ORG } from '@/common/decorators/allow-pending-org.decorator';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';

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
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_ORG, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowPending) return true;
    const allowAny = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ORG_STATUS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowAny) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const orgId = req?.user?.organizationId ?? null;
    if (!orgId) return true; // no org context – let other guards handle

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { status: true },
    });
    if (!org) return true;

    if (org.status === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ORG_SUSPENDED,
        message: 'Organization is suspended',
      });
    }
    if (org.status === OrganizationStatus.PENDING) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ORG_PENDING,
        message: 'Organization is not yet active',
      });
    }
    return true;
  }
}
