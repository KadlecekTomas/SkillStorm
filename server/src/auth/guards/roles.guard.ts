import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AllowedRoles } from '../decorators/roles.decorator';
import { JwtPayload } from 'src/auth/types/jwt-payload';

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

    if (
      requirements.system &&
      requirements.system.length > 0 &&
      !requirements.system.includes(user.systemRole ?? null)
    ) {
      return false;
    }

    if (
      requirements.organization &&
      requirements.organization.length > 0 &&
      !requirements.organization.includes(user.organizationRole ?? null)
    ) {
      return false;
    }

    return true;
  }
}
