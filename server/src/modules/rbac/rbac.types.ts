import { OrganizationRole, PermissionKey, SystemRole } from '@prisma/client';

export type PermissionToken = PermissionKey | SystemRole | OrganizationRole;

export type CacheEntry = {
  value: boolean;
  expires: number;
};
