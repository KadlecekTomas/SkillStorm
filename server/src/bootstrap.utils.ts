/**
 * Pure bootstrap utilities — no NestJS imports, no side-effects.
 * Exported here so unit tests can import without triggering the full app bootstrap.
 */

/**
 * Fail fast if required environment variables are missing in production.
 */
export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_SECRET', 'CORS_ORIGINS', 'DATABASE_URL'] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
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
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
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
