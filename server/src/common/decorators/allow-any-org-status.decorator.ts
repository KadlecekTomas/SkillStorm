import { SetMetadata } from '@nestjs/common';

export const ALLOW_ANY_ORG_STATUS = 'allowAnyOrgStatus';

/**
 * Bypass RequireActiveOrganizationGuard and RequireOrgReadyGuard.
 * Use for: create organization, auth flows.
 */
export const AllowAnyOrgStatus = () => SetMetadata(ALLOW_ANY_ORG_STATUS, true);
