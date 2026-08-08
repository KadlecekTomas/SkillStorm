import { createHash } from 'crypto';

import { ACCESS_TOKEN_COOKIE } from '@/auth/token-cookies';

export type ThrottleRequest = {
  ip?: string;
  originalUrl?: string;
  url?: string;
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, unknown>;
};

const IP_SCOPED_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/sso/google',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function normalizedPath(req: ThrottleRequest): string {
  const raw = req.originalUrl || req.url || '';
  const pathname = raw.split('?')[0] ?? '';
  return pathname.replace(/^\/api(?=\/)/, '');
}

function bearerToken(req: ThrottleRequest): string | null {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * School networks commonly put many teachers/tablets behind one public IP.
 * A pure IP tracker would therefore let one busy classroom throttle another.
 * Sensitive public auth routes remain IP-scoped, while normal authenticated
 * traffic is isolated per access-token session. The token is never stored in
 * the throttle key; only a one-way SHA-256 digest is used.
 */
export function resolveThrottleTracker(req: ThrottleRequest): string {
  const ip = req.ip || 'unknown';
  if (IP_SCOPED_AUTH_PATHS.has(normalizedPath(req))) {
    return `ip:${ip}`;
  }

  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ?? bearerToken(req);
  if (!token) {
    return `ip:${ip}`;
  }

  const digest = createHash('sha256').update(token).digest('hex');
  return `session:${digest}`;
}
