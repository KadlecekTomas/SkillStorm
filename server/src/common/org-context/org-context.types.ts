import type { OrganizationRole } from '@prisma/client';

export type OrgContext = {
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  activeAcademicYearId: string | null;
};
