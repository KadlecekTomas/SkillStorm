import { EventEmitter } from 'events';

export const RBAC_INVALIDATE_EVENT = 'rbac.invalidate';

export type RbacInvalidatePayload = {
  userId?: string | null;
  organizationId?: string | null;
  reason?: string;
};

export const rbacEvents = new EventEmitter();
rbacEvents.setMaxListeners(50);

export function emitRbacInvalidation(payload: RbacInvalidatePayload) {
  rbacEvents.emit(RBAC_INVALIDATE_EVENT, payload);
}
