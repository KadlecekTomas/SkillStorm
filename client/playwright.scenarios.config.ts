import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../server/scripts/db-safety.js');

/**
 * Playwright config for the SCENARIO suite (tests/scenarios) — real browser,
 * real backend, deterministic seeded *_test DB. Separate from the legacy
 * suite (playwright.config.ts) so it stays green and self-contained.
 *
 *   globalSetup  → recreate + migrate + seed skillstorm_test (Prisma/psql)
 *   webServer    → backend :4200 (guarded to the test DB) + frontend :3001
 *   setup project → log in each role → storageState
 *   scenario projects (desktop + mobile) depend on setup
 */
const E2E_DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST ||
    'postgresql://postgres:postgres@localhost:5432/skillstorm_test?schema=public',
  'playwright.scenarios webServer',
);

const { DATABASE_URL: _ignored, ...rawAmbient } = process.env;
// Playwright's webServer.env is Record<string,string>; drop undefined values
// (process.env is Record<string,string|undefined>).
const ambientEnv = Object.fromEntries(
  Object.entries(rawAmbient).filter(([, v]) => v !== undefined),
) as Record<string, string>;

const storage = (role: string) =>
  join(__dirname, 'tests', 'scenarios', '.auth', `${role}.json`);

export default defineConfig({
  testDir: './tests/scenarios',
  // Scenarios coordinate multiple browser contexts and rely on shared seed
  // state; run serially for determinism (concurrency is exercised WITHIN a
  // test in the class-writes-together block).
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-scenarios' }]],

  globalSetup: require.resolve('./tests/scenarios/global-setup.ts'),

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3001',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: [
    {
      command: 'npm --prefix ../server run start:e2e',
      url: 'http://127.0.0.1:4200/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...ambientEnv,
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: '4200',
        JWT_SECRET: process.env.JWT_SECRET || 'dev',
        DATABASE_URL: E2E_DATABASE_URL,
        DISABLE_CSRF: '1',
        // Rate-limit block needs the throttler ON; keep it enabled here and
        // let non-auth specs stay well under the limits.
        DISABLE_THROTTLE: process.env.DISABLE_THROTTLE || '0',
        TRUST_PROXY: '1',
      },
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...ambientEnv,
        PORT: '3001',
        API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4200',
      },
    },
  ],

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      testMatch: /.*\.scenario\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: /.*\.mobile\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'] },
    },
  ],
});

export { storage };
