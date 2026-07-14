import { defineConfig } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../server/scripts/db-safety.js');

function withDefinedEnv(
  values: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

// The backend under test is configured EXCLUSIVELY via DATABASE_URL_TEST —
// an inherited DATABASE_URL (dev shell, .env) is intentionally ignored so a
// Playwright run can never point the server under test at a dev/prod DB.
// The guard additionally enforces the "_test" database-name suffix.
const E2E_DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST ||
    'postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public',
  'playwright.config webServer',
);

// Never forward the ambient DATABASE_URL to the servers we spawn.
const { DATABASE_URL: _ignoredDatabaseUrl, ...ambientEnv } = process.env;

export default defineConfig({
  testDir: './tests/e2e',

  timeout: 60000,

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3001',
    headless: true,
    // Diagnostics: keep a trace + screenshot for any failed test (artifacts are only produced
    // on failure, so this is safe for the whole suite). 'on-first-retry' never fired because
    // retries default to 0.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: [
    {
      command: 'npm --prefix ../server run start:e2e',
      url: 'http://127.0.0.1:4200/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: withDefinedEnv({
        ...ambientEnv,
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: '4200',
        JWT_SECRET: process.env.JWT_SECRET || 'dev',
        DATABASE_URL: E2E_DATABASE_URL,
        DISABLE_CSRF: '1',
        DISABLE_THROTTLE: '1',
        E2E_TEST_TOKEN: process.env.E2E_TEST_TOKEN || 'skillstorm-e2e-token',
      }),
    },
    {
      command:
        'npm run dev -- --hostname 127.0.0.1 --port 3001',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: true,
      timeout: 180_000,
      env: withDefinedEnv({
        ...ambientEnv,
        PORT: '3001',
        API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4200',
      }),
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
