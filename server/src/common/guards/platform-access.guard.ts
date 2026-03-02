import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import type { RequestWithUser } from '@/types/request-with-user';
import {
  PLATFORM_ACCESS_LEVEL_KEY,
  PlatformAccessLevel,
} from '../decorators/platform-access.decorator';

/** All system roles allowed to read platform data. */
const READ_ROLES: readonly SystemRole[] = [
  SystemRole.SUPERADMIN,
  SystemRole.DEVOPS,
  SystemRole.SUPPORT,
] as const;

/** Only SUPERADMIN may perform write operations on platform entities. */
const MUTATION_ROLES: readonly SystemRole[] = [SystemRole.SUPERADMIN] as const;

/**
 * Semantic platform access guard.
 *
 * Reads @RequirePlatformAccess() metadata from the handler first, then the class.
 * Maps PlatformAccessLevel → allowed system roles and enforces accordingly.
 *
 * Guard chain for platform controller:
 *   JwtAuthGuard → PlatformAccessGuard
 *
 * Class-level default:   @RequirePlatformAccess(PlatformAccessLevel.READ)
 * Mutation override:     @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
 */
@Injectable()
export class PlatformAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const level = this.reflector.getAllAndOverride<PlatformAccessLevel | undefined>(
      PLATFORM_ACCESS_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No access level annotation → not a platform-restricted endpoint; skip.
    if (!level) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const systemRole = req.user?.systemRole as SystemRole | undefined;

    const allowed: readonly SystemRole[] =
      level === PlatformAccessLevel.MUTATION ? MUTATION_ROLES : READ_ROLES;

    if (!systemRole || !allowed.includes(systemRole)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN_PLATFORM_ACCESS',
        message: `${level} access requires system role in [${allowed.join(', ')}]`,
      });
    }

    return true;
  }
}
