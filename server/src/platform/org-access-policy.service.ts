import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { OrganizationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestWithUser } from '@/types/request-with-user';
import { ALLOW_PENDING_ORG } from '@/common/decorators/allow-pending-org.decorator';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';

type OrgAccessDecision = {
  allowAny: boolean;
  allowPending: boolean;
  orgId: string | null;
  route: string;
  orgStatus: OrganizationStatus | null;
};

type CachedOrgAccessDecision = OrgAccessDecision & {
  loggedPending: boolean;
};

const ORG_ACCESS_CACHE_KEY = '__orgAccessPolicyDecision';

@Injectable()
export class OrgAccessPolicy {
  private readonly logger = new Logger(OrgAccessPolicy.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    reflector: Reflector,
    context: ExecutionContext,
  ): Promise<OrgAccessDecision> {
    const req = context.switchToHttp().getRequest<
      RequestWithUser & {
        [ORG_ACCESS_CACHE_KEY]?: CachedOrgAccessDecision;
      }
    >();

    if (req?.[ORG_ACCESS_CACHE_KEY]) {
      const cached = req[ORG_ACCESS_CACHE_KEY];
      return {
        allowAny: cached.allowAny,
        allowPending: cached.allowPending,
        orgId: cached.orgId,
        route: cached.route,
        orgStatus: cached.orgStatus,
      };
    }

    const allowPending =
      reflector.getAllAndOverride<boolean>(ALLOW_PENDING_ORG, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const allowAny =
      reflector.getAllAndOverride<boolean>(ALLOW_ANY_ORG_STATUS, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    const orgId = req?.user?.organizationId ?? null;
    const route = this.describeRoute(req);

    let orgStatus: OrganizationStatus | null = null;
    if (orgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true },
      });
      orgStatus = org?.status ?? null;
    }

    const decision: CachedOrgAccessDecision = {
      allowAny,
      allowPending,
      orgId,
      route,
      orgStatus,
      loggedPending: false,
    };

    if (orgStatus === OrganizationStatus.PENDING) {
      this.logPendingAccess(decision);
      decision.loggedPending = true;
    }

    if (req) {
      req[ORG_ACCESS_CACHE_KEY] = decision;
    }

    return {
      allowAny: decision.allowAny,
      allowPending: decision.allowPending,
      orgId: decision.orgId,
      route: decision.route,
      orgStatus: decision.orgStatus,
    };
  }

  async countCurrentAcademicYears(orgId: string): Promise<number> {
    return this.prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });
  }

  private describeRoute(req: RequestWithUser | undefined): string {
    if (!req) return 'UNKNOWN_ROUTE';
    const method = req.method ?? 'UNKNOWN';
    const path =
      req.route?.path ?? req.originalUrl ?? req.url ?? 'UNKNOWN_PATH';
    return `${method} ${path}`;
  }

  private logPendingAccess(decision: CachedOrgAccessDecision): void {
    this.logger.log(
      JSON.stringify({
        event: 'pending_org_route_access',
        orgId: decision.orgId,
        route: decision.route,
        allowPending: decision.allowPending,
      }),
    );
  }
}
