import { SetMetadata } from '@nestjs/common';
import type { $Enums } from '@prisma/client';

export const ROLES_KEY = 'roles';

type AnyRole = $Enums.SystemRole | $Enums.OrganizationRole;

export const Roles = (...roles: AnyRole[]) => SetMetadata(ROLES_KEY, roles);
