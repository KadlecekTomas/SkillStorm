import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_ORG = 'allowPendingOrg';

/**
 * Routes with this decorator bypass RequireActiveOrganizationGuard and RequireOrgReadyGuard.
 * Use for onboarding: create academic year, create first class section.
 */
export const AllowPendingOrg = () => SetMetadata(ALLOW_PENDING_ORG, true);
