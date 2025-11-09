import { SetMetadata } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';

export const ROLES_KEY = 'auth_roles';

export type AllowedRoles = {
  system?: SystemRole[];
  organization?: OrganizationRole[];
};

export const Roles = (roles: AllowedRoles) => SetMetadata(ROLES_KEY, roles);
