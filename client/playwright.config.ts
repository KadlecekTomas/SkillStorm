import { defineConfig } from '@playwright/test';

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
      command: 'npm run start:dev --prefix ../server',
      url: 'http://127.0.0.1:4200/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
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
      },
    },
    {
      command:
        'npm run dev -- --hostname 127.0.0.1 --port 3001',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        PORT: '3001',
        API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4200',
      },
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
