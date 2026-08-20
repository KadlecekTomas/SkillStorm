import { createHash } from 'crypto';

import { ACCESS_TOKEN_COOKIE } from '@/auth/token-cookies';

export type ThrottleRequest = {
  ip?: string;
  originalUrl?: string;
  url?: string;
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

const IP_SCOPED_AUTH_PATHS = new Set([
  '/auth/register',
  '/auth/sso/google',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

const SCHOOL_SHARED_IP_LOGIN_PATHS = new Set(['/auth/login']);

function normalizedPath(req: ThrottleRequest): string {
  const raw = req.originalUrl || req.url || '';
  const pathname = raw.split('?')[0] ?? '';
  return pathname.replace(/^\/api(?=\/)/, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function bearerToken(req: ThrottleRequest): string | null {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

function normalizedLoginEmail(req: ThrottleRequest): string | null {
  const email = req.body?.email;
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function isSchoolSharedIpLogin(req: ThrottleRequest): boolean {
  return SCHOOL_SHARED_IP_LOGIN_PATHS.has(normalizedPath(req));
}

export function resolveSchoolAuthIpTracker(req: ThrottleRequest): string {
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * School networks commonly put many users behind one public IP.
 *
 * Normal authenticated traffic is isolated per access-token session. Password
 * login keeps its tight route-level limit, but scopes it to IP + normalized
 * account rather than IP alone so distinct pupils behind one NAT do not block
 * one another. The account identifier is represented only by a SHA-256 digest.
 * A second named throttler supplies the coarse shared-IP anti-spray budget.
 */
export function resolveThrottleTracker(req: ThrottleRequest): string {
  const ip = req.ip || 'unknown';
  const path = normalizedPath(req);

  if (SCHOOL_SHARED_IP_LOGIN_PATHS.has(path)) {
    const email = normalizedLoginEmail(req);
    if (!email) return `ip:${ip}`;
    return `login-account:${sha256(`${ip}|${email}`)}`;
  }

  if (IP_SCOPED_AUTH_PATHS.has(path)) {
    return `ip:${ip}`;
  }

  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ?? bearerToken(req);
  if (!token) {
    return `ip:${ip}`;
  }

  return `session:${sha256(token)}`;
}
