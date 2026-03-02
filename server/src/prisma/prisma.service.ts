import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OrganizationType, PlanTarget, PrismaClient } from '@prisma/client';
import { getPrismaContext } from './prisma-context';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super();
    this.$use(this.enforceAuditLogImmutability);
    this.$use(this.enforceSubscriptionTargets);
  }

  /**
   * GDPR invariant: AuditLog records are append-only.
   *
   * Blocked unconditionally:
   *   update      — single-row mutation is never permitted
   *   delete      — records must never be deleted
   *   deleteMany  — bulk delete is never permitted, even with bypass
   *
   * Conditionally permitted:
   *   updateMany  — allowed ONLY when the call runs inside
   *                 `runWithPrismaContext({ auditRetentionBypass: true }, ...)`,
   *                 which is set exclusively by AuditRetentionService.
   *                 Even then, only `userId`, `ipAddress`, `userAgent` may be
   *                 touched, and all three must be set to `null`.
   */
  private readonly enforceAuditLogImmutability: Prisma.Middleware = async (
    params,
    next,
  ) => {
    if (params.model !== 'AuditLog') return next(params);

    // Structural mutations: always blocked, no bypass.
    if (['update', 'delete', 'deleteMany'].includes(params.action)) {
      throw new Error(
        'AuditLog records are immutable. Structural mutations (update, delete, deleteMany) are prohibited.',
      );
    }

    // updateMany: only the retention job may call this, and only to null PII.
    if (params.action === 'updateMany') {
      const ctx = getPrismaContext();
      if (!ctx.auditRetentionBypass) {
        throw new Error(
          'AuditLog.updateMany is restricted to the GDPR retention anonymization job. ' +
            'Use runWithPrismaContext({ auditRetentionBypass: true }, ...) in AuditRetentionService.',
        );
      }

      // Field allowlist: only PII fields may be set, and only to null.
      const RETENTION_ALLOWED_FIELDS = new Set(['userId', 'ipAddress', 'userAgent']);
      const data =
        (params.args as { data?: Record<string, unknown> })?.data ?? {};
      const dataKeys = Object.keys(data);

      const forbidden = dataKeys.filter((k) => !RETENTION_ALLOWED_FIELDS.has(k));
      if (forbidden.length > 0) {
        throw new Error(
          `AuditLog retention updateMany: forbidden field(s) [${forbidden.join(', ')}]. ` +
            'Only userId, ipAddress, userAgent may be set.',
        );
      }

      for (const [k, v] of Object.entries(data)) {
        if (v !== null) {
          throw new Error(
            `AuditLog retention updateMany: field "${k}" must be null. ` +
              'Non-null writes are not permitted — retention anonymizes, it does not modify.',
          );
        }
      }
    }

    return next(params);
  };

  private readonly enforceSubscriptionTargets: Prisma.Middleware = async (
    params,
    next,
  ) => {
    if (
      params.model === 'Subscription' &&
      ['create', 'update', 'upsert'].includes(params.action)
    ) {
      const context = await this.resolveSubscriptionContext(params);

      if (context?.organizationId && context?.planId) {
        const [organization, plan] = await Promise.all([
          this.organization.findUnique({
            where: { id: context.organizationId },
            select: { type: true },
          }),
          this.subscriptionPlan.findUnique({
            where: { id: context.planId },
            select: { target: true },
          }),
        ]);

        if (
          organization?.type === OrganizationType.SCHOOL &&
          plan?.target === PlanTarget.PRIVATE
        ) {
          throw new Error(
            'SCHOOL organizations cannot subscribe to PRIVATE plans.',
          );
        }
      }
    }

    return next(params);
  };

  private async resolveSubscriptionContext(
    params: Prisma.MiddlewareParams,
  ): Promise<{ organizationId?: string; planId?: string } | null> {
    if (params.action === 'create') {
      return this.extractSubscriptionIds(params.args?.data);
    }

    if (params.action === 'upsert') {
      return this.extractSubscriptionIds(params.args?.create);
    }

    if (params.action === 'update') {
      const updates = this.extractSubscriptionIds(params.args?.data);
      if (updates.organizationId && updates.planId) {
        return updates;
      }
      const current = await this.subscription.findUnique({
        where: params.args?.where,
        select: { organizationId: true, planId: true },
      });
      return {
        organizationId: updates.organizationId ?? current?.organizationId,
        planId: updates.planId ?? current?.planId,
      };
    }

    return null;
  }

  private extractSubscriptionIds(input: any) {
    if (!input) return {};
    const organizationId =
      input.organizationId ?? input.organization?.connect?.id ?? undefined;
    const planId = input.planId ?? input.plan?.connect?.id ?? undefined;
    return { organizationId, planId };
  }
}
