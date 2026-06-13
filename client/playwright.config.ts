import { defineConfig } from '@playwright/test';

function withDefinedEnv(
  values: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

export default defineConfig({
  testDir: './tests/e2e',

  timeout: 60000,

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3001',
    headless: true,
    trace: 'on-first-retry',
  },

  webServer: [
    {
      command: 'npm --prefix ../server run start:e2e',
      url: 'http://127.0.0.1:4200/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: withDefinedEnv({
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: '4200',
        JWT_SECRET: process.env.JWT_SECRET || 'dev',
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/skillstorm',
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
        ...process.env,
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
