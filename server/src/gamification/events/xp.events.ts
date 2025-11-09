import { EventEmitter } from 'events';
import { XpEventType } from '@prisma/client';

export const XP_AWARDED_EVENT = 'xp.awarded';

export type XpAwardedPayload = {
  membershipId: string;
  userId: string | null;
  organizationId: string | null;
  type: XpEventType;
  amount: number;
  metadata?: Record<string, any> | null;
};

export const xpEvents = new EventEmitter();
xpEvents.setMaxListeners(50);

export function emitXpAwarded(payload: XpAwardedPayload) {
  xpEvents.emit(XP_AWARDED_EVENT, payload);
}
