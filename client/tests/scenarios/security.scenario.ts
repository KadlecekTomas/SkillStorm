import { test, expect, uiLogin } from './fixtures';
import { request as playwrightRequest } from '@playwright/test';

/**
 * BLOK 4 — security scenarios in the UI.
 *  - a student cannot open a foreign (other-org) assignment by URL
 *  - a teacher cannot read another org's test by URL
 *  - session expiry mid-work returns the user to where they were after re-login
 *  - login rate limiting surfaces a clear 429 message, not a broken page
 */

test('student cannot open a foreign-org assignment by URL', async ({ asRole, manifest }) => {
  const { page } = await asRole('student8a');
  await page.goto(`/app/assignments/${manifest.foreignAssignmentId}/test`, {
    waitUntil: 'commit',
  });
  // no focus session renders; a friendly error is shown instead of a crash
  await expect(page.getByTestId('test-top-status-bar')).toBeHidden();
  await expect(
    page.getByText(/nebyl přiřazen|nebylo nalezeno|přístup|nemáš/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test('teacher cannot read another org test by URL', async ({ asRole, manifest }) => {
  const { page } = await asRole('teacher');
  await page.goto(`/app/tests/${manifest.foreignTestId}`, { waitUntil: 'commit' });
  // the foreign test title never appears; an error/empty state does
  await expect(page.getByText('Cizí test (org Druhá)')).toBeHidden();
  await expect(
    page.getByText(/nenalezen|nemáte|přístup|Chyba|nebyl/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test('session expiry mid-work returns to the original page after re-login', async ({
  asRole,
  manifest,
}) => {
  const { page, context } = await asRole('student8a');
  // land on a specific deep page
  await page.goto('/app/results', { waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/app\/results/);

  // simulate expiry: drop the session cookies, then force an authed reload
  await context.clearCookies();
  await page.reload({ waitUntil: 'commit' });

  // the app bounces to login carrying the return path (?from=/app/results)
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  expect(page.url()).toMatch(/results/);

  // fill the form IN PLACE (re-navigating to /login would drop ?from) →
  // PostAuthResolver returns us to /app/results
  await page.getByPlaceholder(/you@school\.edu/i).fill(manifest.accounts.student8a);
  await page.getByPlaceholder(/••••••••/i).fill(manifest.password);
  await page.getByRole('button', { name: /sign in|přihlásit/i }).click();
  await page.waitForURL(/\/app\/results/, { timeout: 20_000 });
});

test('login rate limit surfaces a clear message, not a broken page', async ({ baseURL, browser }) => {
  const ip = '198.51.100.7';
  // exhaust the login bucket for this IP via the API (limit is 10 / 900 s)
  const api = await playwrightRequest.newContext({
    baseURL: baseURL ?? 'http://127.0.0.1:3001',
    extraHTTPHeaders: { 'X-Forwarded-For': ip },
  });
  let sawThrottle = false;
  for (let i = 0; i < 12; i++) {
    const r = await api.post('/api/auth/login', {
      data: { email: 'nobody@scenar.test', password: 'wrong-password' },
      failOnStatusCode: false,
    });
    if (r.status() === 429) sawThrottle = true;
  }
  await api.dispose();
  expect(sawThrottle, 'API eventually returns 429').toBeTruthy();

  // now the login FORM from the same (throttled) IP must show a
  // comprehensible error and stay usable — not a blank/broken page.
  const ctx = await browser.newContext({
    extraHTTPHeaders: { 'X-Forwarded-For': ip },
  });
  const page = await ctx.newPage();
  await page.goto('/login', { waitUntil: 'commit' });
  const email = page.getByPlaceholder(/you@school\.edu/i);
  await expect(email).toBeVisible({ timeout: 20_000 });
  await email.fill('teacher@scenar.test');
  await page.getByPlaceholder(/••••••••/i).fill('Scenar123!');
  const throttled = page.waitForResponse(
    (r) => /\/auth\/login/.test(r.url()) && r.status() === 429,
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: /sign in|přihlásit/i }).click();
  await throttled; // the login request was rate-limited
  await expect(page.getByText(/Příliš mnoho pokusů/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Přihlášení do SkillStorm/i })).toBeVisible();
  await ctx.close();
});
