import type { OrganizationRole } from '@prisma/client';

export type OrgContext = {
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  activeAcademicYearId: string | null;
  /** True when the active year's endsAt is in the past. Write ops must be blocked for non-directors. */
  isAcademicYearExpired: boolean;
};
