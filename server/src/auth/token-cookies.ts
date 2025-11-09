import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'skillstorm_at';
export const REFRESH_TOKEN_COOKIE = 'skillstorm_rt';

type CookieSecurity = { secure: boolean };

const accessTokenTtlMs = 15 * 60 * 1000; // 15 minutes
const refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  options: CookieSecurity,
) {
  const base = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: options.secure,
    path: '/',
  };

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: accessTokenTtlMs,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: refreshTokenTtlMs,
    path: '/auth',
  });
}

export function clearAuthCookies(res: Response, options: CookieSecurity) {
  const base = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: options.secure,
  };
  res.cookie(ACCESS_TOKEN_COOKIE, '', {
    ...base,
    path: '/',
    maxAge: 0,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, '', {
    ...base,
    path: '/auth',
    maxAge: 0,
  });
}

export function extractCookie(req: { headers?: Record<string, any> }, name: string) {
  const raw = req.headers?.cookie;
  if (!raw) return null;
  const target = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!target) return null;
  const [, value] = target.split('=');
  return decodeURIComponent(value ?? '');
}
