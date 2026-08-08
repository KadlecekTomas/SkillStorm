import { test, expect } from './fixtures';

const PLATFORM_ROUTES = [
  '/app/platform',
  '/app/platform/organizations',
  '/app/platform/users',
  '/app/platform/catalog',
  '/app/platform/audit',
  '/app/platform/support',
  '/app/platform/health',
] as const;

const unwrap = <T>(value: T | { data?: T }): T =>
  typeof value === 'object' && value !== null && 'data' in value
    ? ((value as { data?: T }).data ?? (value as T))
    : (value as T);

test.describe('whole-app release — platform workspace', () => {
  test('SUPERADMIN without school membership can open every platform surface cleanly', async ({
    asRole,
  }) => {
    const { page } = await asRole('superadmin');
    await page.setViewportSize({ width: 1440, height: 900 });

    const apiFailures: string[] = [];
    const consoleErrors: string[] = [];
    const schoolContextLeaks: string[] = [];
    const pageErrors: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (!url.includes('/api/')) return;
      if (response.status() === 403 || response.status() >= 500) {
        apiFailures.push(`${response.status()} ${url}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
      if (message.text().includes('SCHOOL CONTEXT LEAK DETECTED')) {
        schoolContextLeaks.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const meResponse = await page.request.get('/api/auth/me');
    expect(meResponse.ok(), 'SUPERADMIN auth profile').toBeTruthy();
    const me = unwrap<{
      systemRole?: string | null;
      organizationId?: string | null;
      isPlatformAdmin?: boolean;
    }>(await meResponse.json());
    expect(me.systemRole).toBe('SUPERADMIN');
    expect(me.organizationId ?? null).toBeNull();
    expect(me.isPlatformAdmin).toBe(true);

    for (const route of PLATFORM_ROUTES) {
      await page.goto(route, { waitUntil: 'commit' });
      await expect(page.getByText('Platform workspace', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}(?:\\?.*)?$`));
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
        )
        .toBe(true);
    }

    await page.goto('/app/platform', { waitUntil: 'commit' });
    await expect(page.getByText('Platform workspace', { exact: true })).toBeVisible();
    await page.screenshot({
      path: 'test-results/release-platform-overview.png',
      fullPage: true,
    });

    await page.goto('/app/platform/organizations', { waitUntil: 'commit' });
    await expect(page.getByText('Platform workspace', { exact: true })).toBeVisible();
    await page.screenshot({
      path: 'test-results/release-platform-organizations.png',
      fullPage: true,
    });

    await page.goto('/handbook', { waitUntil: 'commit' });
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);

    expect(apiFailures, 'platform routes must not trigger forbidden/server API responses').toEqual([]);
    expect(schoolContextLeaks, 'platform routes must never fetch school-context APIs').toEqual([]);
    expect(consoleErrors, 'platform routes must not log console errors').toEqual([]);
    expect(pageErrors, 'platform routes must not throw browser errors').toEqual([]);
  });

  test('school director cannot enter the system platform workspace', async ({ asRole }) => {
    const { page } = await asRole('director');
    await page.goto('/app/platform', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/app(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText('Platform workspace', { exact: true })).toHaveCount(0);
  });
});
