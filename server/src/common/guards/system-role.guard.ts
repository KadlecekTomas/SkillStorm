import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import { REQUIRE_SYSTEM_ROLE_KEY } from '../decorators/require-system-role.decorator';

/**
 * Metadata-driven guard for system-role enforcement.
 *
 * Reads @RequireSystemRole() metadata from the handler (wins) then the class.
 * If no metadata is present, the guard is a no-op (lets other guards handle auth).
 *
 * Usage: register in module providers + apply @UseGuards(SystemRoleGuard) on controller.
 */
@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      REQUIRE_SYSTEM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const systemRole = req.user?.systemRole as SystemRole | undefined;

    if (!systemRole || !requiredRoles.includes(systemRole)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN_SYSTEM_ROLE',
        message: `This action requires one of the following system roles: ${requiredRoles.join(', ')}`,
      });
    }

    return true;
  }
}
