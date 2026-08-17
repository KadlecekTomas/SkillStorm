import { defineConfig, devices } from '@playwright/test';

/**
 * Black-box certification against the production Docker stack.
 *
 * Important differences from playwright.scenarios.config.ts:
 * - does NOT start Next/Nest dev servers;
 * - expects docker-compose.prod.yml runner images to already be healthy;
 * - exercises only curated school-critical journeys that are forbidden from
 *   mocking SkillStorm's own /api boundary;
 * - records video for every certification test as release evidence.
 */
export default defineConfig({
  testDir: './tests/scenarios',
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-product-certification' }],
  ],

  globalSetup: require.resolve('./tests/scenarios/global-setup.ts'),

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'school-product-certification',
      dependencies: ['setup'],
      testMatch:
        /(backbone|concurrency|live-session|people-management|progress|release-surfaces|school-readiness|security)\.scenario\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
