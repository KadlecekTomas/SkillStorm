import { SetMetadata } from '@nestjs/common';
import { PermissionToken } from './rbac.types';

export const PERMISSION_KEY = 'required_permissions';

export const Permission = (...permissions: PermissionToken[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
