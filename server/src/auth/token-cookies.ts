import { Response } from 'express';
import { randomBytes } from 'crypto';

export const ACCESS_TOKEN_COOKIE = 'ss_at';
export const REFRESH_TOKEN_COOKIE = 'ss_rt';
export const CSRF_TOKEN_COOKIE = 'ss_csrf';

const isSecure = process.env.NODE_ENV === 'production';

const base = {
  httpOnly: true,
  secure: isSecure,
  sameSite: 'lax' as const,
  path: '/',
};

export function setCsrfCookie(res: Response, token: string) {
  res.cookie(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_TOKEN_COOKIE, {
    path: '/',
    secure: isSecure,
    sameSite: 'lax',
  });
}

export function generateCsrfToken() {
  return randomBytes(24).toString('hex');
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
  });
}
