import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Algorithm Lab — Trace & Debug Mission', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('forces prediction before trace and verifies a debug hypothesis', async ({ page }) => {
    await page.goto('/app/labs/algorithm-lab/tracing');

    await expect(page.getByRole('heading', { name: 'Trace & Debug Mission' })).toBeVisible();
    await expect(page.getByTestId('trace-signal-core')).toContainText('0%');
    await expect(page.getByTestId('trace-run')).toBeDisabled();

    await page.getByTestId('trace-cell-2-1').click();
    await page.getByTestId('trace-direction-EAST').click();
    await page.getByTestId('trace-lock-prediction').click();
    await expect(page.getByTestId('trace-signal-core')).toContainText('34%');
    await expect(page.getByTestId('trace-run')).toBeEnabled();

    await page.screenshot({
      path: 'test-results/algorithm-lab-17-trace-prediction.png',
      fullPage: true,
    });

    await page.getByTestId('trace-run').click();
    await expect(page.getByTestId('trace-result')).toContainText('Predikce sedí.', { timeout: 10_000 });
    await expect(page.getByTestId('trace-robot')).toHaveAttribute('data-x', '2');
    await expect(page.getByTestId('trace-robot')).toHaveAttribute('data-y', '1');
    await expect(page.getByTestId('trace-robot')).toHaveAttribute('data-direction', 'EAST');
    await expect(page.getByTestId('trace-log').locator('p')).toHaveCount(5);
    await expect(page.getByTestId('trace-signal-core')).toContainText('67%');

    await page.screenshot({
      path: 'test-results/algorithm-lab-18-trace-result.png',
      fullPage: true,
    });

    await page.getByTestId('trace-start-debug').click();
    await expect(page.getByTestId('debug-challenge')).toBeVisible();
    await page.getByTestId('debug-step-2').click();
    await page.getByTestId('debug-verify').click();
    await expect(page.getByTestId('debug-result')).toContainText('První neplatný krok je 2.', { timeout: 10_000 });
    await expect(page.getByTestId('debug-result')).toContainText('Tvoje hypotéza odpovídala skutečnému execution trace.');
    await expect(page.getByTestId('trace-signal-core')).toContainText('100%');

    await page.screenshot({
      path: 'test-results/algorithm-lab-19-debug-hypothesis.png',
      fullPage: true,
    });
  });
});
