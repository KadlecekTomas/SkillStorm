import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { deriveOrgReadiness, OrgReadinessState } from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import {
  ORG_OPERATION_KEY,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { OrgAccessPolicy } from './org-access-policy.service';

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
    private readonly accessPolicy: OrgAccessPolicy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = await this.accessPolicy.resolve(this.reflector, context);
    if (access.allowAny || access.allowPending) return true;

    const orgId = access.orgId;
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
