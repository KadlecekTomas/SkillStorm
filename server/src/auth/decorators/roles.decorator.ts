import { SetMetadata } from '@nestjs/common';
import { $Enums } from '../../../generated/prisma';

// Klíč pro metadata
export const ROLES_KEY = 'roles';

// Dekorátor, který přidá požadované role k endpointu
export const Roles = (...roles: $Enums.Role[]) => SetMetadata(ROLES_KEY, roles);
