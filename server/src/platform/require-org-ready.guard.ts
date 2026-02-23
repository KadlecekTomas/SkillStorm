import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { deriveOrgReadiness, OrgReadinessState } from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import type { RequestWithUser } from '@/types/request-with-user';
import { ALLOW_PENDING_ORG } from '@/common/decorators/allow-pending-org.decorator';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';
import {
  ORG_OPERATION_KEY,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

/**
 * Organization Readiness Guard
 *
 * NOT_READY:
 *   - AUTHORING operations allowed
 *   - EXECUTION operations blocked
 *
 * READY:
 *   - all operations allowed (RBAC applies)
 *
 * Operation type is explicitly declared via @OrgOperation decorator.
 * Default behavior is EXECUTION for safety.
 */
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

    const operationType =
      this.reflector.getAllAndOverride<OrgOperationType>(ORG_OPERATION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? OrgOperationType.EXECUTION;

    const readiness = await deriveOrgReadiness(this.prisma, orgId);

    if (!readiness.canExecute && operationType === OrgOperationType.EXECUTION) {
      throw createOrgReadinessError({
        operationType,
        state: readiness.state,
        missing: readiness.missing,
        requiredMinState: OrgReadinessState.R2_STRUCTURE_READY,
        messageOverride: 'Organization is not ready for execution operations.',
      });
    }

    return true;
  }
}
