import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AllowedRoles } from '@/auth/decorators/roles.decorator';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';
import type { JwtPayload } from '@/auth/types/jwt-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirements = this.reflector.getAllAndOverride<AllowedRoles>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirements) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new UnauthorizedException();
    }

    if (requirements.system && requirements.system.length > 0) {
      const systemRole = user.systemRole;
      if (!systemRole || !requirements.system.includes(systemRole)) {
        return false;
      }
    }

    if (requirements.organization && requirements.organization.length > 0) {
      const organizationRole = user.organizationRole;
      if (
        !organizationRole ||
        !requirements.organization.includes(organizationRole)
      ) {
        return false;
      }
    }

    return true;
  }
}
