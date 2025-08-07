// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { $Enums } from '@prisma/client';

type AnyRole = $Enums.SystemRole | $Enums.OrganizationRole;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AnyRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No user found in request');
    }

    const userRoles: AnyRole[] = [];

    if (user.systemRole) userRoles.push(user.systemRole);
    if (user.organizationRole) userRoles.push(user.organizationRole);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required: ${requiredRoles.join(', ')} | Found: ${userRoles.join(', ')}`,
      );
    }

    return true;
  }
}
