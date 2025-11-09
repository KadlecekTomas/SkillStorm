import { createHash } from 'crypto';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
