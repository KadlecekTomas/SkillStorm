import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { PERMISSION_KEY } from './permission.decorator';
import { PermissionToken } from './rbac.types';
import { RbacService } from './rbac.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly rbac: RbacService,
    private readonly reflector: Reflector,
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
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Forbidden: user not resolved from token',
      });
    }

    const organizationId =
      req.params?.organizationId ??
      req.query?.organizationId ??
      req.body?.organizationId ??
      user.organizationId ??
      null;

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
      return user.organizationRole === token;
    }

    return this.rbac.canUser(user.userId ?? user.id, organizationId, token);
  }

  private isSystemRole(token: PermissionToken): token is SystemRole {
    return Object.values(SystemRole).includes(token as SystemRole);
  }

  private isOrganizationRole(
    token: PermissionToken,
  ): token is OrganizationRole {
    return Object.values(OrganizationRole).includes(token as OrganizationRole);
  }
}
