import { SetMetadata } from '@nestjs/common';

export const ORG_OPERATION_KEY = 'orgOperation';

export enum OrgOperationType {
  AUTHORING = 'AUTHORING',
  EXECUTION = 'EXECUTION',
}

/**
 * Declares the organization operation type for RequireOrgReadyGuard.
 * NOT_READY orgs allow AUTHORING and block EXECUTION.
 * When omitted, default is EXECUTION (safe).
 */
export const OrgOperation = (type: OrgOperationType) =>
  SetMetadata(ORG_OPERATION_KEY, type);
