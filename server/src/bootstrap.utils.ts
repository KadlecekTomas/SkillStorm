/**
 * Pure bootstrap utilities — no NestJS imports, no side-effects.
 * Exported here so unit tests can import without triggering the full app bootstrap.
 */

/**
 * Fail fast if required environment variables are missing in production.
 */
export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGINS',
    'DATABASE_URL',
    'METRICS_INGEST_KEY',
    'PUBLIC_APP_URL',
    'API_URL',
  ] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  validateProductionSecret('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET);
  validateProductionSecret(
    'JWT_REFRESH_SECRET',
    process.env.JWT_REFRESH_SECRET,
  );
  validateProductionSecret(
    'METRICS_INGEST_KEY',
    process.env.METRICS_INGEST_KEY,
  );

  validateCsrfConfiguration();

  const corsOrigins = process.env
    .CORS_ORIGINS!.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.some((origin) => origin.includes('*'))) {
    throw new Error(
      'CORS_ORIGINS must be an explicit allowlist in production. Wildcards are not allowed.',
    );
  }

  const publicAppUrl = parseRequiredUrl(
    'PUBLIC_APP_URL',
    process.env.PUBLIC_APP_URL!,
  );
  const apiUrl = parseRequiredUrl('API_URL', process.env.API_URL!);
  const allowCrossSiteCookies = process.env.ALLOW_CROSS_SITE_COOKIES === '1';

  if (!corsOrigins.includes(publicAppUrl.origin)) {
    throw new Error(
      `CORS_ORIGINS must include PUBLIC_APP_URL origin (${publicAppUrl.origin}).`,
    );
  }

  if (!isSameSite(publicAppUrl, apiUrl) && !allowCrossSiteCookies) {
    throw new Error(
      'Cross-site cookie deployment detected: PUBLIC_APP_URL and API_URL are not same-site. ' +
        'Use the same-site /api proxy topology or set ALLOW_CROSS_SITE_COOKIES=1 only after an explicit review.',
    );
  }
}

export function validateCsrfConfiguration(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DISABLE_CSRF === '1'
  ) {
    throw new Error('DISABLE_CSRF=1 is not allowed when NODE_ENV=production.');
  }
}

/**
 * Build a CORS origin callback from a comma-separated list of allowed origins.
 * In non-production, localhost/127.0.0.1/frontend origins are allowed automatically.
 */
export function buildCorsOrigin(
  rawOrigins: string | undefined,
  isProduction: boolean,
): (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  const allowedOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (
      !isProduction &&
      /^https?:\/\/(localhost|127\.0\.0\.1|frontend)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  };
}

function parseRequiredUrl(name: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function isSameSite(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol &&
    siteKey(left.hostname) === siteKey(right.hostname)
  );
}

function validateProductionSecret(
  name: string,
  value: string | undefined,
): void {
  const normalized = value?.trim() ?? '';
  if (normalized.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production.`);
  }

  const lowered = normalized.toLowerCase();
  const weakMarkers = [
    'secret',
    'changeme',
    'change_me',
    'password',
    'dev',
    'test',
    'default',
  ];
  if (weakMarkers.some((marker) => lowered.includes(marker))) {
    throw new Error(`${name} uses an insecure placeholder/default value.`);
  }
}

function siteKey(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === 'frontend' ||
    normalized === 'backend' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized) ||
    normalized.includes(':') ||
    !normalized.includes('.')
  ) {
    return normalized;
  }

  const labels = normalized.split('.');
  if (labels.length < 2) {
    return normalized;
  }

  return labels.slice(-2).join('.');
}
