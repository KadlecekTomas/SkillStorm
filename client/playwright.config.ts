import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  timeout: 60000,

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3001',
    headless: false,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
