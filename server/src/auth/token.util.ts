import * as crypto from 'crypto';

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function timingSafeEqualHex(leftHex: string, rightHex: string): boolean {
  if (leftHex.length !== rightHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(leftHex), Buffer.from(rightHex));
}

export function matchesTokenHash(
  rawToken: string,
  storedHash: string,
): boolean {
  const hashed = hashToken(rawToken);
  return timingSafeEqualHex(hashed, storedHash);
}
