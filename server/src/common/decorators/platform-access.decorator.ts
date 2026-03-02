import { SetMetadata } from '@nestjs/common';

/**
 * Semantic access tiers for platform endpoints.
 *
 * READ    — observability access: SUPERADMIN | DEVOPS | SUPPORT
 * MUTATION — write access: SUPERADMIN only
 *
 * Use @RequirePlatformAccess() on the controller class (default tier)
 * and override on individual mutation handlers.
 */
export enum PlatformAccessLevel {
  READ = 'READ',
  MUTATION = 'MUTATION',
}

export const PLATFORM_ACCESS_LEVEL_KEY = 'platformAccessLevel';

export const RequirePlatformAccess = (level: PlatformAccessLevel) =>
  SetMetadata(PLATFORM_ACCESS_LEVEL_KEY, level);
