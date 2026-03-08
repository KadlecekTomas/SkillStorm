import { validateEnvironment, buildCorsOrigin } from '../../src/bootstrap.utils';

// ---------------------------------------------------------------------------
// validateEnvironment
// ---------------------------------------------------------------------------

describe('validateEnvironment', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('does not throw in development even when required vars are missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('does not throw in test mode even when required vars are missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('throws when JWT_SECRET is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.JWT_SECRET;

    expect(() => validateEnvironment()).toThrow(/JWT_SECRET/);
  });

  it('throws when CORS_ORIGINS is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.CORS_ORIGINS;

    expect(() => validateEnvironment()).toThrow(/CORS_ORIGINS/);
  });

  it('throws when DATABASE_URL is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.DATABASE_URL;

    expect(() => validateEnvironment()).toThrow(/DATABASE_URL/);
  });

  it('throws when METRICS_INGEST_KEY is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.METRICS_INGEST_KEY;

    expect(() => validateEnvironment()).toThrow(/METRICS_INGEST_KEY/);
  });

  it('throws when PUBLIC_APP_URL is missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.PUBLIC_APP_URL;

    expect(() => validateEnvironment()).toThrow(/PUBLIC_APP_URL/);
  });

  it('rejects wildcard CORS origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://*.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';

    expect(() => validateEnvironment()).toThrow(/Wildcards are not allowed/);
  });

  it('rejects cross-site cookie topology without explicit override', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.other-site.net';
    delete process.env.ALLOW_CROSS_SITE_COOKIES;

    expect(() => validateEnvironment()).toThrow(/Cross-site cookie deployment detected/);
  });

  it('allows cross-site cookie topology only with explicit override', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.other-site.net';
    process.env.ALLOW_CROSS_SITE_COOKIES = '1';

    expect(() => validateEnvironment()).not.toThrow();
  });

  it('lists all missing variables in a single error in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;

    expect(() => validateEnvironment()).toThrow(
      /JWT_SECRET.*CORS_ORIGINS.*DATABASE_URL.*METRICS_INGEST_KEY.*PUBLIC_APP_URL.*API_URL/,
    );
  });

  it('does not throw when all required vars are set in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = 'metrics-key';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';

    expect(() => validateEnvironment()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildCorsOrigin
// ---------------------------------------------------------------------------

function callOrigin(
  handler: ReturnType<typeof buildCorsOrigin>,
  origin: string | undefined,
): Promise<{ err: Error | null; allow: boolean | undefined }> {
  return new Promise((resolve) => {
    handler(origin, (err, allow) => resolve({ err, allow }));
  });
}

describe('buildCorsOrigin', () => {
  describe('production mode', () => {
    const handler = buildCorsOrigin('https://app.example.com,https://admin.example.com', true);

    it('allows a request with no origin (server-to-server)', async () => {
      const { err, allow } = await callOrigin(handler, undefined);
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    it('allows an explicitly listed origin', async () => {
      const { err, allow } = await callOrigin(handler, 'https://app.example.com');
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    it('allows the second listed origin', async () => {
      const { err, allow } = await callOrigin(handler, 'https://admin.example.com');
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    it('rejects an origin that is not in the allowlist', async () => {
      const { err } = await callOrigin(handler, 'https://evil.com');
      expect(err).toBeInstanceOf(Error);
    });

    it('does NOT auto-allow localhost in production', async () => {
      const { err } = await callOrigin(handler, 'http://localhost:3000');
      expect(err).toBeInstanceOf(Error);
    });

    it('does NOT auto-allow 127.0.0.1 in production', async () => {
      const { err } = await callOrigin(handler, 'http://127.0.0.1:3000');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('non-production mode', () => {
    const handler = buildCorsOrigin(undefined, false);

    it('allows localhost origins automatically', async () => {
      const { err, allow } = await callOrigin(handler, 'http://localhost:3000');
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    it('allows 127.0.0.1 origins automatically', async () => {
      const { err, allow } = await callOrigin(handler, 'http://127.0.0.1:4200');
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    it('rejects unknown non-localhost origin even in non-production', async () => {
      const { err } = await callOrigin(handler, 'https://unknown-host.com');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('CORS_ORIGINS trimming', () => {
    it('trims whitespace around each origin entry', async () => {
      const handler = buildCorsOrigin('  https://a.example.com , https://b.example.com  ', true);
      const { err: errA, allow: allowA } = await callOrigin(handler, 'https://a.example.com');
      const { err: errB, allow: allowB } = await callOrigin(handler, 'https://b.example.com');
      expect(errA).toBeNull();
      expect(allowA).toBe(true);
      expect(errB).toBeNull();
      expect(allowB).toBe(true);
    });
  });
});
