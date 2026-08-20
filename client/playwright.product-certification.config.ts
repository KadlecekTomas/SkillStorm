import { defineConfig, devices } from '@playwright/test';

/**
 * Black-box certification against the production Docker stack through the
 * same HTTPS edge shape required by production Secure cookies.
 *
 * The CI TLS edge uses an ephemeral internal CA, so certificate-chain trust is
 * ignored here; HTTPS itself remains mandatory and all Secure-cookie behavior
 * is exercised normally. Chromium also receives the matching launch-level flag
 * because context-level ignoreHTTPSErrors does not suppress every subresource
 * certificate diagnostic emitted by the browser.
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
    baseURL: process.env.BASE_URL || 'https://localhost:3443',
    headless: true,
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--ignore-certificate-errors'],
    },
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
