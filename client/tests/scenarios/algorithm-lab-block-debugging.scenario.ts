import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Algorithm Lab block debugging', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('executes visibly step by step before diagnosis, repair and transfer', async ({ page }) => {
    await page.goto('/app/labs/algorithm-lab/block-programming/debug');

    await expect(page.getByRole('heading', { name: 'Broken Loop' })).toBeVisible();
    await expect(page.getByTestId('debug-repeat-count')).toHaveText('4×');
    await expect(page.getByTestId('debug-repeat-minus')).toBeDisabled();
    await expect(page.getByTestId('debug-trace-step-1')).toHaveCount(0);

    // One manual step must reveal exactly one runtime event, move the robot once,
    // and highlight the concrete source iteration instead of exposing the final result.
    await page.getByTestId('debug-step').click();
    await expect(page.getByTestId('debug-runner-status')).toContainText('Pozastaveno');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '1');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-y', '0');
    await expect(page.getByTestId('debug-trace-step-1')).toContainText('Krok vpřed → [1,0]');
    await expect(page.getByTestId('debug-trace-step-2')).toHaveCount(0);
    await expect(page.getByTestId('debug-active-source')).toContainText('opakování 1');
    await expect(page.getByTestId('debug-active-iteration')).toHaveText('opakování 1/4');

    await page.getByTestId('debug-step').click();
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '2');
    await expect(page.getByTestId('debug-active-iteration')).toHaveText('opakování 2/4');

    await page.getByTestId('debug-step').click();
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '3');
    await expect(page.getByTestId('debug-active-iteration')).toHaveText('opakování 3/4');

    // The fourth iteration hits the wall. The robot stays on the last valid cell,
    // execution stops, and only then does diagnosis unlock.
    await page.getByTestId('debug-step').click();
    await expect(page.getByTestId('debug-runner-status')).toContainText('Dokončeno');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '3');
    await expect(page.getByTestId('debug-trace-step-4')).toContainText('OBSTACLE');
    await expect(page.getByTestId('debug-active-iteration')).toHaveText('opakování 4/4');
    await expect(page.getByTestId('debug-active-source')).toContainText('blok 1 · opakování 4 · příkaz 1');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('krok 4');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('blok 1 · opakování 4 · příkaz 1');

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
    await expect(page.getByTestId('debug-runner-status')).toContainText('Připraveno');

    // Automatic playback is also covered, but use fast mode in CI so the test
    // proves animation semantics without wasting suite time.
    await page.getByTestId('debug-speed-fast').click();
    await page.getByTestId('debug-run').click();
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('debug-mission-success')).toContainText('Program už funguje.');
    await expect(page.getByTestId('debug-trace-step-8')).toContainText('Krok vpřed → [4,2]');

    await page.getByTestId('debug-transfer-4').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Příliš mnoho opakování');
    await expect(page.getByTestId('debug-mastery')).toHaveCount(0);

    await page.getByTestId('debug-transfer-3').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Správně');
    await expect(page.getByTestId('debug-mastery')).toContainText('Princip ověřen na změněné situaci.');

    await page.screenshot({ path: 'test-results/algorithm-lab-23-broken-loop-mastery.png', fullPage: true });
  });
});
