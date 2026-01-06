import type {
  OrganizationRole,
  PermissionKey,
  SystemRole,
} from '@prisma/client';

export type PermissionToken = PermissionKey | SystemRole | OrganizationRole;

export type CacheEntry = {
  value: boolean;
  expires: number;
  cacheKey: string;
};

export type JwtLikeUser = {
  userId?: string;
  id?: string;
  organizationId?: string | null;
  organizationRole?: OrganizationRole | null;
  systemRole?: SystemRole | null;
};
