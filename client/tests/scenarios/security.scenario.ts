import { test, expect } from './fixtures';
import { request as playwrightRequest } from '@playwright/test';

/**
 * BLOK 4 — security scenarios in the UI.
 *  - a student cannot open a foreign (other-org) assignment by URL
 *  - a teacher cannot read another org's test by URL
 *  - session expiry mid-work returns the user to where they were after re-login
 *  - login throttling is account-aware behind school NAT and preserves client-IP buckets
 */

test('student cannot open a foreign-org assignment by URL', async ({ asRole, manifest }) => {
  const { page } = await asRole('student8a');
  await page.goto(`/app/assignments/${manifest.foreignAssignmentId}/test`, {
    waitUntil: 'commit',
  });
  await expect(page.getByTestId('test-top-status-bar')).toBeHidden();
  await expect(
    page.getByText(/nebyl přiřazen|nebylo nalezeno|přístup|nemáš/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test('teacher cannot read another org test by URL', async ({ asRole, manifest }) => {
  const { page } = await asRole('teacher');
  await page.goto(`/app/tests/${manifest.foreignTestId}`, { waitUntil: 'commit' });
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
  await page.goto('/app/results', { waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/app\/results/);

  await context.clearCookies();
  await page.reload({ waitUntil: 'commit' });

  await page.waitForURL(/\/login/, { timeout: 20_000 });
  expect(page.url()).toMatch(/results/);

  await page.getByLabel(/e-?mail/i).fill(manifest.accounts.student8a);
  await page.getByLabel(/heslo/i).fill(manifest.password);
  await page.getByRole('button', { name: /sign in|přihlásit/i }).click();
  await page.waitForURL(/\/app\/results/, { timeout: 20_000 });
});

test('login throttling protects one account without collapsing proxy IP buckets', async ({
  baseURL,
  browser,
  manifest,
}) => {
  const throttledIp = '198.51.100.7';
  const independentIp = '198.51.100.8';
  const loginUrl = '/api/auth/login';
  const loginData = {
    email: manifest.accounts.teacher,
    organizationId: manifest.orgId,
  };

  // Exhaust the tight 10 / 15 min bucket for ONE real account from ONE IP.
  // This deliberately uses a valid account with the wrong password so the
  // subsequent UI login for the same account must be throttled.
  const api = await playwrightRequest.newContext({
    baseURL: baseURL ?? 'http://127.0.0.1:3001',
    extraHTTPHeaders: { 'X-Forwarded-For': throttledIp },
  });
  let sawThrottle = false;
  for (let i = 0; i < 12; i++) {
    const r = await api.post(loginUrl, {
      data: { ...loginData, password: 'wrong-password' },
      failOnStatusCode: false,
    });
    if (r.status() === 429) sawThrottle = true;
  }
  await api.dispose();
  expect(sawThrottle, 'same account + same IP eventually returns 429').toBeTruthy();

  // The browser on that same upstream IP must get the same bucket through the
  // real Next -> Nest production proxy and show a comprehensible UI error.
  const throttledContext = await browser.newContext({
    extraHTTPHeaders: { 'X-Forwarded-For': throttledIp },
  });
  const page = await throttledContext.newPage();
  await page.goto('/login', { waitUntil: 'commit' });
  const email = page.getByLabel(/e-?mail/i);
  await expect(email).toBeVisible({ timeout: 20_000 });
  await email.fill(manifest.accounts.teacher);
  await page.getByLabel(/heslo/i).fill(manifest.password);
  const throttled = page.waitForResponse(
    (r) => /\/auth\/login/.test(r.url()) && r.status() === 429,
    { timeout: 20_000 },
  );
  const submit = page.getByRole('button', { name: /sign in|přihlásit/i });
  await submit.click();
  await throttled;

  await expect(page.getByText(/Příliš mnoho pokusů/i)).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /přihlášení/i })).toBeVisible();
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
  await expect(page.getByLabel(/heslo/i)).toBeVisible();
  await expect(submit).toBeEnabled();
  await throttledContext.close();

  // Critical proxy proof: the SAME account from a DIFFERENT upstream IP must
  // still be able to authenticate. If production forgot TRUST_PROXY (or Next
  // loses the forwarded client address), this request lands in the exhausted
  // proxy-wide bucket and the certification fails.
  const independent = await playwrightRequest.newContext({
    baseURL: baseURL ?? 'http://127.0.0.1:3001',
    extraHTTPHeaders: { 'X-Forwarded-For': independentIp },
  });
  const independentLogin = await independent.post(loginUrl, {
    data: { ...loginData, password: manifest.password },
    failOnStatusCode: false,
  });
  expect(independentLogin.status(), 'different upstream IP remains independent').toBeLessThan(300);
  expect(independentLogin.status()).toBeGreaterThanOrEqual(200);
  await independent.dispose();
});
