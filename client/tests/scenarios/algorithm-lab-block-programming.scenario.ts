import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Algorithm Lab block programming', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('builds a repeat body explicitly and executes its expanded trace', async ({ page }) => {
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

    await page.getByTestId('block-run').click();

    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('block-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('block-result')).toContainText('Mise splněna se smyčkou.');
    await expect(page.getByTestId('block-trace')).toContainText('8. Krok vpřed → [4,2]');

    await page.screenshot({ path: 'test-results/algorithm-lab-21-loop-success.png', fullPage: true });
  });
});
