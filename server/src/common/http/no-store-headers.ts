import type { Request, Response } from 'express';

export const NO_STORE_CACHE_CONTROL =
  'no-store, no-cache, must-revalidate, private';

export function applyNoStoreHeaders(
  res: Response,
  req?: Request | undefined,
): void {
  if (req) {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
  }

  res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
}
