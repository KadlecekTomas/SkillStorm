import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Director intervention cockpit', () => {
  test.use({ storageState: storageStateFor('director') });

  test('prioritizes actionable school signals before summary metrics', async ({ page }) => {
    const badResponses: string[] = [];
    const consoleErrors: string[] = [];

    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    const cockpit = page.getByTestId('director-attention-cockpit');
    await expect(cockpit).toBeVisible({ timeout: 30_000 });
    await expect(cockpit.getByRole('heading', { name: 'Co vyžaduje pozornost' })).toBeVisible();
    await expect(cockpit.getByText('Třídy s rizikem')).toBeVisible();
    await expect(cockpit.getByText('Žáci k prověření')).toBeVisible();
    await expect(cockpit.getByText('Učitelé bez aktivity')).toBeVisible();

    const summary = page.getByRole('heading', { name: 'Stav školy v číslech' });
    await expect(summary).toBeVisible();

    const cockpitBox = await cockpit.boundingBox();
    const summaryBox = await summary.boundingBox();
    expect(cockpitBox, 'cockpit has a rendered box').not.toBeNull();
    expect(summaryBox, 'summary has a rendered box').not.toBeNull();
    expect(cockpitBox!.y, 'attention cockpit appears before summary metrics').toBeLessThan(
      summaryBox!.y,
    );

    await expect(page.getByText('Proč tu nevidíte parťáky žáků?')).toHaveCount(0);
    expect(badResponses, `no API 4xx/5xx: ${badResponses.join(', ')}`).toEqual([]);
    expect(consoleErrors, `no console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});
