import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { PERMISSION_KEY } from './permission.decorator';
import type { PermissionToken } from './rbac.types';
import { RbacService } from './rbac.service';
import { hasAtLeastRole } from '@/shared/access.utils';
import { MetricsService } from '@/metrics/metrics.service';
import { PermissionKey } from '@prisma/client';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly rbac: RbacService,
    private readonly reflector: Reflector,
    private readonly metrics: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<PermissionToken[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      await this.recordDenied(
        req,
        null,
        permissions,
        'Forbidden: user not resolved from token',
      );
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Forbidden: user not resolved from token',
      });
    }

    // Invariant: OWNER has full access to all org resources; never apply permission checks.
    if (user.organizationRole === OrganizationRole.OWNER) {
      return true;
    }

    const organizationId = user.organizationId ?? null;

    const evaluations = await Promise.all(
      permissions.map(async (permission) => ({
        token: permission,
        allowed: await this.evaluatePermission(
          permission,
          user,
          organizationId,
        ),
      })),
    );

    const granted = evaluations.find((entry) => entry.allowed);

    if (granted) {
      return true;
    }

    const missingKey = permissions.join(' | ');
    await this.recordDenied(
      req,
      user,
      permissions,
      `Forbidden: missing permission ${missingKey}`,
    );
    throw new ForbiddenException({
      statusCode: 403,
      message: `Forbidden: missing permission ${missingKey}`,
    });
  }

  private async evaluatePermission(
    token: PermissionToken,
    user: any,
    organizationId: string | null,
  ) {
    if (this.isSystemRole(token)) {
      return user.systemRole === token;
    }

    if (this.isOrganizationRole(token)) {
      if (token === OrganizationRole.DIRECTOR) {
        return hasAtLeastRole(
          user.organizationRole ?? null,
          OrganizationRole.DIRECTOR,
        );
      }
      if (token === OrganizationRole.OWNER) {
        return user.organizationRole === OrganizationRole.OWNER;
      }
      return user.organizationRole === token;
    }

    return this.rbac.canUser(
      user.userId ?? user.id,
      organizationId,
      token,
      user.organizationRole ?? null,
    );
  }

  private isSystemRole(token: PermissionToken): token is SystemRole {
    return Object.values(SystemRole).includes(token as SystemRole);
  }

  private isOrganizationRole(
    token: PermissionToken,
  ): token is OrganizationRole {
    return Object.values(OrganizationRole).includes(token as OrganizationRole);
  }

  private async recordDenied(
    req: {
      originalUrl?: string;
      url?: string;
    },
    user: {
      userId?: string | null;
      id?: string | null;
      organizationId?: string | null;
    } | null,
    permissions: PermissionToken[],
    message: string,
  ): Promise<void> {
    const firstPermission = permissions[0];
    const permissionKey =
      permissions.length === 1 &&
      firstPermission !== undefined &&
      this.isPermissionKey(firstPermission)
        ? firstPermission
        : null;

    await this.metrics.recordForbiddenAccess({
      route: req.originalUrl ?? req.url ?? 'unknown',
      userId: user?.userId ?? user?.id ?? null,
      organizationId: user?.organizationId ?? null,
      permissionKey,
      message,
    });
  }

  private isPermissionKey(token: PermissionToken): token is PermissionKey {
    return Object.values(PermissionKey).includes(token as PermissionKey);
  }
}
