import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Data Detective', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('finds dirty data, cleans safely and rejects a false majority', async ({ page }) => {
    await page.goto('/app/labs/data-detective');

    await expect(page.getByRole('heading', { name: 'Špinavá data, chybný závěr' })).toBeVisible();
    await expect(page.getByTestId('data-raw-summary')).toContainText('Pěšky 3 z 5');
    await expect(page.getByTestId('data-raw-summary')).toContainText('60 %');

    await page.getByTestId('data-select-r5').click();
    await page.getByTestId('data-diagnose-exact_duplicate').click();
    await expect(page.getByTestId('data-diagnosis-feedback')).toContainText('Stejný kód');

    await page.getByTestId('data-select-r6').click();
    await page.getByTestId('data-diagnose-missing_required').click();
    await expect(page.getByTestId('data-diagnosis-feedback')).toContainText('Povinná hodnota dopravy chybí');

    await page.getByTestId('data-select-r7').click();
    await page.getByTestId('data-diagnose-invalid_category').click();
    await expect(page.getByTestId('data-detected-count')).toContainText('3/3');

    await page.getByTestId('data-resolve-missing_required-unsafe').click();
    await expect(page.getByTestId('data-resolution-feedback')).toContainText('svévolně změnil');
    await expect(page.getByTestId('data-resolution-status')).toContainText('0/3');

    await page.getByTestId('data-resolve-exact_duplicate-safe').click();
    await page.getByTestId('data-resolve-missing_required-safe').click();
    await page.getByTestId('data-resolve-invalid_category-safe').click();
    await expect(page.getByTestId('data-resolution-status')).toContainText('3/3');

    await expect(page.getByTestId('data-clean-summary')).toContainText('Pěšky 2 z 4');
    await expect(page.getByTestId('data-clean-summary')).toContainText('50 %');

    await page.screenshot({ path: 'test-results/release-it3-data-detective-cleaning.png', fullPage: true });

    await page.getByTestId('data-claim-yes').click();
    await expect(page.getByTestId('data-claim-feedback')).toContainText('více než polovinu');

    await page.getByTestId('data-claim-no').click();
    await expect(page.getByTestId('data-claim-feedback')).toContainText('50 % není většina');

    await page.getByTestId('data-transfer-both').click();
    await expect(page.getByTestId('data-transfer-feedback')).toContainText('dvě různé otázky');
    await expect(page.getByTestId('data-mastery')).toHaveCount(0);

    await page.getByTestId('data-transfer-most_only').click();
    await expect(page.getByTestId('data-transfer-feedback')).toContainText('Autobus není většina');
    await expect(page.getByTestId('data-mastery')).toContainText('Závěr stojí na vyčištěných datech.');

    await page.screenshot({ path: 'test-results/release-it3-data-detective-mastery.png', fullPage: true });
  });
});
