import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Algorithm Lab block programming', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('builds a loop and observes its execution incrementally', async ({ page }) => {
    await page.goto('/app/labs/algorithm-lab/block-programming');

    await expect(page.getByRole('heading', { name: 'Loop Mission' })).toBeVisible();
    await expect(page.getByTestId('block-program')).toContainText('Začni blokem');

    await page.getByTestId('block-add-repeat').click();
    await expect(page.getByTestId('block-validation')).toContainText('Každá smyčka musí obsahovat alespoň jeden příkaz.');
    await expect(page.getByTestId('block-run')).toBeDisabled();

    await page.getByTestId('repeat-0-add-forward').click();
    await expect(page.getByTestId('block-validation')).toHaveCount(0);
    await expect(page.getByTestId('repeat-block-0')).toContainText('Krok vpřed');
    await expect(page.getByTestId('repeat-count-0')).toHaveText('3×');

    await page.getByTestId('block-add-right').click();
    await page.getByTestId('block-add-forward').click();
    await page.getByTestId('block-add-forward').click();
    await page.getByTestId('block-add-left').click();
    await page.getByTestId('block-add-forward').click();

    await expect(page.getByTestId('block-program')).toContainText('Opakuj');
    await expect(page.getByTestId('block-run')).toBeEnabled();
    await page.screenshot({ path: 'test-results/algorithm-lab-20-loop-program.png', fullPage: true });

    // A single manual step must not expose the final result. It moves the robot
    // once, reveals one trace row and identifies the first loop iteration.
    await page.getByTestId('block-step').click();
    await expect(page.getByTestId('block-runner-status')).toContainText('Pozastaveno');
    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-x', '1');
    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-y', '0');
    await expect(page.getByTestId('block-trace-step-1')).toContainText('Krok vpřed → [1,0]');
    await expect(page.getByTestId('block-trace-step-2')).toHaveCount(0);
    await expect(page.getByTestId('repeat-active-iteration-0')).toHaveText('opakování 1/3');
    await expect(page.getByTestId('block-result')).toHaveCount(0);

    // Resume the same execution instead of starting over. Fast mode keeps CI
    // efficient while the manual-step assertions above protect the teaching UX.
    await page.getByTestId('block-speed-fast').click();
    await page.getByTestId('block-pause').click();

    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('block-result')).toContainText('Mise splněna se smyčkou.');
    await expect(page.getByTestId('block-trace-step-8')).toContainText('Krok vpřed → [4,2]');
    await expect(page.getByTestId('block-runner-status')).toContainText('Dokončeno');

    await page.screenshot({ path: 'test-results/algorithm-lab-21-loop-success.png', fullPage: true });
  });
});
