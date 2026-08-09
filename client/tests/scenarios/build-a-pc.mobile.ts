import { expect, test } from '@playwright/test';

test('Build a PC stays playable on a student phone-sized viewport', async ({ page }) => {
  await page.goto('/app/labs/build-a-pc');

  await expect(page.getByRole('heading', { name: 'Build a PC · První boot' })).toBeVisible();
  await expect(page.getByTestId('build-progress-label')).toHaveText('0 %');

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);

  await page.getByTestId('component-cpu').click();
  await page.getByTestId('slot-cpu-socket').click();
  await expect(page.getByTestId('build-progress-label')).toHaveText('13 %');

  await page.screenshot({ path: 'test-results/build-a-pc-mobile.png', fullPage: true });
});
