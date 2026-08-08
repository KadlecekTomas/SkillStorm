import { test, expect } from './fixtures';

const PUBLIC_SURFACES = [
  '/',
  '/login',
  '/register',
  '/reset-password',
  '/public-library',
  '/eduto',
  '/handbook',
] as const;

async function expectNoOverflow(page: import('@playwright/test').Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

test.describe('whole-app release — public, account and legacy surfaces', () => {
  test('public/auth surfaces render cleanly on phone and desktop and primary CTAs navigate', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const serverFailures: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of PUBLIC_SURFACES) {
        const response = await page.goto(route, { waitUntil: 'commit' });
        expect(response?.status() ?? 200, `${route} document response`).toBeLessThan(500);
        await expect(page.locator('body')).not.toContainText('Application error');
        await expect(page.locator('body')).not.toContainText('Internal Server Error');
        await expectNoOverflow(page);
      }
    }

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.getByRole('link', { name: 'Vyzkoušet demo' })).toBeVisible();
    await page.getByRole('link', { name: 'Vyzkoušet demo' }).click();
    await expect(page).toHaveURL(/\/register(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Vytvoření účtu/i })).toBeVisible();

    await page.goto('/', { waitUntil: 'commit' });
    await page.getByRole('link', { name: 'Přihlásit se' }).first().click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Přihlášení/i })).toBeVisible();

    await page.goto('/', { waitUntil: 'commit' });
    await page.screenshot({
      path: 'test-results/release-public-mobile.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/eduto', { waitUntil: 'commit' });
    await page.screenshot({
      path: 'test-results/release-eduto-desktop.png',
      fullPage: true,
    });

    expect(serverFailures, 'public surfaces must not return 5xx').toEqual([]);
    expect(consoleErrors, 'public surfaces must not log console errors').toEqual([]);
    expect(pageErrors, 'public surfaces must not throw browser errors').toEqual([]);
  });

  test('unauthenticated join intent fails closed to login instead of exposing app content', async ({
    page,
  }) => {
    await page.goto('/join?code=SCENARIO-NOT-A-REAL-CODE', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Přihlášení/i })).toBeVisible();
  });

  test('authenticated account security surface is functional and responsive without mutating credentials', async ({
    asRole,
  }) => {
    const { page } = await asRole('director');
    const failures: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && (response.status() === 403 || response.status() >= 500)) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/account/security', { waitUntil: 'commit' });
      await expect(page.getByRole('heading', { name: 'Bezpečnost' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Změnit heslo' })).toBeVisible();
      await expectNoOverflow(page);
    }

    expect(failures, 'account security must not trigger forbidden/server API responses').toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('legacy static dashboard routes resolve to canonical app routes', async ({ asRole }) => {
    const { page } = await asRole('director');
    const aliases = [
      '/dashboard',
      '/dashboard/tests',
      '/dashboard/assignments',
      '/dashboard/settings',
      '/dashboard/subjects',
      '/dashboard/teachers',
    ] as const;

    for (const alias of aliases) {
      await page.goto(alias, { waitUntil: 'commit' });
      await expect(page).toHaveURL(/\/app(?:\/|$)/, { timeout: 15_000 });
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});
