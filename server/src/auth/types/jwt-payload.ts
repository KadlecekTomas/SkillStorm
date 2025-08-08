import type { SystemRole, OrganizationRole } from '@prisma/client';

export type JwtPayload = {
  userId: string;
  email: string;
  systemRole?: SystemRole;
  organizationRole?: OrganizationRole;
  organizationId?: string;
};
