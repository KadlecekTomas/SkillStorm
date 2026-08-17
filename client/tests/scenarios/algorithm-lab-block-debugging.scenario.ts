import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Algorithm Lab block debugging', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('uses trace evidence to diagnose, repair and transfer a broken loop', async ({ page }) => {
    await page.goto('/app/labs/algorithm-lab/block-programming/debug');

    await expect(page.getByRole('heading', { name: 'Broken Loop' })).toBeVisible();
    await expect(page.getByTestId('debug-repeat-count')).toHaveText('4×');
    await expect(page.getByTestId('debug-repeat-minus')).toBeDisabled();

    await page.getByTestId('debug-run').click();

    await expect(page.getByTestId('debug-failure-evidence')).toContainText('krok 4');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('blok 1 · opakování 4 · příkaz 1');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('OBSTACLE');
    await expect(page.getByTestId('debug-trace-step-4')).toContainText('OBSTACLE');
    await expect(page.getByTestId('debug-repeat-block')).toContainText('Trace ukazuje na tento zdrojový blok.');

    await page.screenshot({ path: 'test-results/algorithm-lab-22-broken-loop-failure.png', fullPage: true });

    await page.getByTestId('debug-hypothesis-wrong_turn').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('nevysvětluje');
    await expect(page.getByTestId('debug-repeat-minus')).toBeDisabled();

    await page.getByTestId('debug-hypothesis-extra_repeat').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('Diagnóza sedí s trace');
    await expect(page.getByTestId('debug-repeat-minus')).toBeEnabled();

    await page.getByTestId('debug-repeat-minus').click();
    await expect(page.getByTestId('debug-repeat-count')).toHaveText('3×');
    await expect(page.getByTestId('debug-repair-status')).toContainText('připraveno k ověření');

    await page.getByTestId('debug-run').click();

    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('debug-mission-success')).toContainText('Program už funguje.');

    await page.getByTestId('debug-transfer-4').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Příliš mnoho opakování');
    await expect(page.getByTestId('debug-mastery')).toHaveCount(0);

    await page.getByTestId('debug-transfer-3').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Správně');
    await expect(page.getByTestId('debug-mastery')).toContainText('Princip ověřen na změněné situaci.');

    await page.screenshot({ path: 'test-results/algorithm-lab-23-broken-loop-mastery.png', fullPage: true });
  });
});
