import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OrganizationType, PlanTarget, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super();
    this.$use(this.enforceSubscriptionTargets);
  }

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
