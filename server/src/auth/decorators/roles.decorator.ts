import { SetMetadata } from '@nestjs/common';
import type { OrganizationRole, SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

type AnyRole = SystemRole | OrganizationRole;

export const Roles = (...roles: AnyRole[]) => SetMetadata(ROLES_KEY, roles);
