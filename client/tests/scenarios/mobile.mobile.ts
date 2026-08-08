import { test, expect, type Page } from '@playwright/test';
import { loadManifest, type ScenarioManifest } from './manifest';

/**
 * BLOK 5 — mobile (Pixel 5, 393px) and offline resilience.
 *
 * Runs under the "mobile" project: Pixel 5 device emulation. Each test signs
 * into a different 2.A student so a long scenario run can never inherit an
 * expired/auto-submitted attempt from an earlier spec.
 */

async function loginFreshYoungStudent(
  page: Page,
  manifest: ScenarioManifest,
  email: string,
): Promise<void> {
  await page.context().clearCookies();
  const response = await page.request.post('/api/auth/login', {
    data: {
      email,
      password: manifest.password,
      organizationId: manifest.orgId,
    },
    headers: {
      'X-Forwarded-For': `10.250.${1 + Math.floor(Math.random() * 200)}.${1 + Math.floor(Math.random() * 200)}`,
    },
  });
  expect(response.ok(), `fresh mobile login for ${email}`).toBeTruthy();
  const me = await page.request.get('/api/auth/me');
  expect(me.ok(), `authenticated mobile session for ${email}`).toBeTruthy();
}

test('student flow on a 390px viewport: bottom tabs, tiles, reachable submit', async ({
  page,
}) => {
  const m = loadManifest();
  await loginFreshYoungStudent(page, m, 'student-2a-02@scenar.test');

  // dashboard shows the mobile bottom navigation (hidden ≥768px)
  await page.goto('/app', { waitUntil: 'commit' });
  const bottomNav = page.getByRole('navigation', { name: 'Hlavní navigace' });
  await expect(bottomNav).toBeVisible({ timeout: 20_000 });
  expect(page.viewportSize()?.width).toBeLessThanOrEqual(420);

  // open the 2.A assignment → young tiles render
  await page.goto(`/app/assignments/${m.assignment2AId}/test`, { waitUntil: 'commit' });
  await expect(page.getByTestId('test-top-status-bar')).toBeVisible({ timeout: 20_000 });
  const tiles = page.getByTestId('answer-option');
  await expect(tiles.first()).toBeVisible();

  // the submit control is present and reachable (in the viewport after scroll)
  const submit = page.getByTestId('submit-test');
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
});

test('offline mid-answering: autosave catches up and UI shows the outage', async ({
  page,
  context,
}) => {
  const m = loadManifest();
  await loginFreshYoungStudent(page, m, 'student-2a-03@scenar.test');
  await page.goto(`/app/assignments/${m.assignment2AId}/test`, { waitUntil: 'commit' });
  await expect(page.getByTestId('test-top-status-bar')).toBeVisible({ timeout: 20_000 });

  // answer the first tile while online and let it save
  const savedOnline = page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 15_000 },
  );
  await page.getByTestId('answer-option').first().click();
  await savedOnline;

  // go offline, change the answer → the UI must surface the outage…
  await context.setOffline(true);
  await page.getByTestId('answer-option').nth(1).click();
  await expect(page.getByTestId('offline-indicator')).toBeVisible({ timeout: 15_000 });

  // …and back online, autosave catches up (a PATCH succeeds) and the
  // offline banner clears
  const savedAfter = page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 20_000 },
  );
  await context.setOffline(false);
  await savedAfter;
  await expect(page.getByTestId('offline-indicator')).toBeHidden({ timeout: 15_000 });
});
