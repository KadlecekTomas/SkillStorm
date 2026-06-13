import { validateEnvironment, buildCorsOrigin } from '../../src/bootstrap.utils';

// ---------------------------------------------------------------------------
// validateEnvironment
// ---------------------------------------------------------------------------

describe('validateEnvironment', () => {
  const ORIGINAL_ENV = process.env;

  // Strong, non-placeholder secrets: >= 32 chars and free of the weak markers
  // (secret/dev/test/default/changeme/password) rejected in production.
  const STRONG_ACCESS = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const STRONG_REFRESH = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';
  const STRONG_METRICS = '9081726354afbecd9081726354afbecd90817263';

  /** Set every required production var to a valid value; tests then delete one. */
  function setAllProductionVars() {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = STRONG_ACCESS;
    process.env.JWT_REFRESH_SECRET = STRONG_REFRESH;
    process.env.CORS_ORIGINS = 'https://app.example.com';
    process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/skillstorm';
    process.env.METRICS_INGEST_KEY = STRONG_METRICS;
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com';
    delete process.env.ALLOW_CROSS_SITE_COOKIES;
    // jest-env sets DISABLE_CSRF=1 for the test process; production validation
    // forbids it, so clear it for these production-config assertions.
    delete process.env.DISABLE_CSRF;
  }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('does not throw in development even when required vars are missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('does not throw in test mode even when required vars are missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('throws when JWT_ACCESS_SECRET is missing in production', () => {
    setAllProductionVars();
    delete process.env.JWT_ACCESS_SECRET;

    expect(() => validateEnvironment()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects an insecure placeholder JWT secret in production', () => {
    setAllProductionVars();
    process.env.JWT_ACCESS_SECRET = 'change_me_super_secret_placeholder_value';

    expect(() => validateEnvironment()).toThrow(/insecure placeholder/);
  });

  it('rejects a too-short JWT secret in production', () => {
    setAllProductionVars();
    process.env.JWT_ACCESS_SECRET = 'short';

    expect(() => validateEnvironment()).toThrow(/at least 32 characters/);
  });

  it('throws when CORS_ORIGINS is missing in production', () => {
    setAllProductionVars();
    delete process.env.CORS_ORIGINS;

    expect(() => validateEnvironment()).toThrow(/CORS_ORIGINS/);
  });

  it('throws when DATABASE_URL is missing in production', () => {
    setAllProductionVars();
    delete process.env.DATABASE_URL;

    expect(() => validateEnvironment()).toThrow(/DATABASE_URL/);
  });

  it('throws when METRICS_INGEST_KEY is missing in production', () => {
    setAllProductionVars();
    delete process.env.METRICS_INGEST_KEY;

    expect(() => validateEnvironment()).toThrow(/METRICS_INGEST_KEY/);
  });

  it('throws when PUBLIC_APP_URL is missing in production', () => {
    setAllProductionVars();
    delete process.env.PUBLIC_APP_URL;

    expect(() => validateEnvironment()).toThrow(/PUBLIC_APP_URL/);
  });

  it('rejects wildcard CORS origins in production', () => {
    setAllProductionVars();
    process.env.CORS_ORIGINS = 'https://*.example.com';

    expect(() => validateEnvironment()).toThrow(/Wildcards are not allowed/);
  });

  it('rejects cross-site cookie topology without explicit override', () => {
    setAllProductionVars();
    process.env.API_URL = 'https://api.other-site.net';

    expect(() => validateEnvironment()).toThrow(/Cross-site cookie deployment detected/);
  });

  it('allows cross-site cookie topology only with explicit override', () => {
    setAllProductionVars();
    process.env.API_URL = 'https://api.other-site.net';
    process.env.ALLOW_CROSS_SITE_COOKIES = '1';

    expect(() => validateEnvironment()).not.toThrow();
  });

  it('lists all missing variables in a single error in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.DATABASE_URL;
    delete process.env.METRICS_INGEST_KEY;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.API_URL;

    expect(() => validateEnvironment()).toThrow(
      /JWT_ACCESS_SECRET.*JWT_REFRESH_SECRET.*CORS_ORIGINS.*DATABASE_URL.*METRICS_INGEST_KEY.*PUBLIC_APP_URL.*API_URL/,
    );
  });

  it('does not throw when all required vars are set in production', () => {
    setAllProductionVars();

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
