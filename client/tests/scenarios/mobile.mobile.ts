import { test, expect } from '@playwright/test';
import { loadManifest } from './manifest';

/**
 * BLOK 5 — mobile (Pixel 5, 393px) and offline resilience.
 *
 * Runs under the "mobile" project: Pixel 5 device emulation + the young 2.A
 * student's storageState (tiles). Uses the default page/context so the
 * viewport and touch emulation apply.
 */

test('student flow on a 390px viewport: bottom tabs, tiles, reachable submit', async ({
  page,
}) => {
  const m = loadManifest();

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
