import { defineConfig, devices } from '@playwright/test';

/**
 * Portfolio screenshoty (scripts/portfolio-shots.ts) — NENÍ testovací suite.
 *
 * Předpoklady (skript si servery nespouští, používá běžící dev stack):
 *   1. dev Postgres (5433) + backend `PORT=4201 npm run start:dev` v server/
 *   2. client dev server na :3000 (API_PROXY_TARGET=http://localhost:4201)
 *   3. `npm run seed:showcase` v server/ (ZŠ a Gymnázium Jasmínová)
 *
 * Spuštění:  npm run portfolio:shots
 * Výstup:    ../docs/screenshots/portfolio/
 */
export default defineConfig({
  testDir: './scripts',
  testMatch: /portfolio-shots\.ts/,
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PORTFOLIO_BASE_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
  },
});
