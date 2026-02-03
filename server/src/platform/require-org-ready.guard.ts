import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { assertOrgReady } from '@/shared/org-readiness.utils';
import type { RequestWithUser } from '@/types/request-with-user';
import { ALLOW_PENDING_ORG } from '@/common/decorators/allow-pending-org.decorator';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';

@Injectable()
export class RequireOrgReadyGuard implements CanActivate {
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
    if (!orgId) return true;

    await assertOrgReady(this.prisma, orgId);
    return true;
  }
}
