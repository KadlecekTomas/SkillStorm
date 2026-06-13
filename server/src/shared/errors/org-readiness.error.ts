import { PreconditionFailedException } from '@nestjs/common';
import type { OrgReadinessState } from '@/shared/org-readiness-v2';
import type { OrgOperationType } from '@/common/decorators/org-operation.decorator';

export const ORG_READINESS_INSUFFICIENT = 'ORG_READINESS_INSUFFICIENT';

export type OrgReadinessErrorPayload = {
  statusCode: 412;
  code: typeof ORG_READINESS_INSUFFICIENT;
  message: string;
  state: OrgReadinessState;
  missing: string[];
  requiredMinState: OrgReadinessState;
  operationType?: OrgOperationType;
};

const DEFAULT_MESSAGE = 'Organization is not ready for this operation.';

export type CreateOrgReadinessErrorOptions = {
  operationType?: OrgOperationType;
  state: OrgReadinessState;
  missing: string[];
  requiredMinState: OrgReadinessState;
  messageOverride?: string;
};

/**
 * Creates a PreconditionFailedException (412) with a uniform org-readiness contract.
 * Use in RequireOrgReadyGuard and in services (Assignments, Submissions, Tests publish).
 */
export function createOrgReadinessError(
  options: CreateOrgReadinessErrorOptions,
): PreconditionFailedException {
  const { operationType, state, missing, requiredMinState, messageOverride } =
    options;

  const payload: OrgReadinessErrorPayload = {
    statusCode: 412,
    code: ORG_READINESS_INSUFFICIENT,
    message: messageOverride ?? DEFAULT_MESSAGE,
    state,
    missing,
    requiredMinState,
  };

  if (operationType !== undefined) {
    payload.operationType = operationType;
  }

  return new PreconditionFailedException(payload);
}
