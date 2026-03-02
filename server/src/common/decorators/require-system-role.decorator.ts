import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export const REQUIRE_SYSTEM_ROLE_KEY = 'requireSystemRole';

/**
 * Metadata-driven system-role guard.
 * Applied on a controller class or individual handler; handler wins via getAllAndOverride.
 *
 * @example
 * // Allow all platform system roles at class level
 * \@RequireSystemRole(SystemRole.SUPERADMIN, SystemRole.DEVOPS, SystemRole.SUPPORT)
 * export class PlatformController {}
 *
 * // Narrow to SUPERADMIN on a specific mutation
 * \@RequireSystemRole(SystemRole.SUPERADMIN)
 * activate() {}
 */
export const RequireSystemRole = (...roles: SystemRole[]) =>
  SetMetadata(REQUIRE_SYSTEM_ROLE_KEY, roles);
