import { SetMetadata } from '@nestjs/common';
import type { PermissionToken } from './rbac.types';

export const PERMISSION_KEY = 'required_permissions';

export const Permission = (...permissions: PermissionToken[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
