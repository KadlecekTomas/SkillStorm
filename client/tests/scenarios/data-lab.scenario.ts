import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Interactive IT Lab — Data Lab', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('cleans evidence before deriving information and system output', async ({ page }) => {
    await page.goto('/app/labs/data-lab');

    await expect(page.getByTestId('data-lab-heading')).toHaveText('Data Lab');
    await expect(page.getByTestId('data-issues-count')).toHaveText('3');
    await expect(page.getByTestId('data-decision-r2')).toBeDisabled();

    // Corrections must come from the visible source evidence, not a magic reset.
    await page.getByTestId('data-cell-r3-code').fill('A-103');
    await expect(page.getByTestId('data-issues-count')).toHaveText('2');

    await page.getByTestId('data-cell-r4-daysBorrowed').fill('12');
    await expect(page.getByTestId('data-issues-count')).toHaveText('1');

    await page.getByTestId('data-cell-r5-borrower').fill('Klára');
    await expect(page.getByTestId('data-issues-count')).toHaveText('0');
    await expect(page.getByTestId('data-clean')).toContainText('konzistentní');
    await expect(page.getByTestId('data-decision-r2')).toBeEnabled();

    // A plausible but unsupported answer is rejected.
    await page.getByTestId('data-decision-r4').click();
    await expect(page.getByTestId('data-decision-result')).toContainText('neodpovídá oběma podmínkám');
    await expect(page.getByTestId('data-system-reminders')).toBeDisabled();

    // The correct decision is derived from returned=false AND days>=14.
    await page.getByTestId('data-decision-r2').click();
    await expect(page.getByTestId('data-decision-result')).toContainText('Matěj má 18 dní');
    await expect(page.getByTestId('data-system-reminders')).toBeEnabled();

    // Understanding the information system is separate learning evidence.
    await page.getByTestId('data-system-raw').click();
    await expect(page.getByTestId('data-system-result')).toContainText('není užitečný výstup');
    await expect(page.getByTestId('data-mastery')).toHaveCount(0);

    await page.getByTestId('data-system-reminders').click();
    await expect(page.getByTestId('data-system-result')).toContainText('Informační systém převádí vstupní data');
    await expect(page.getByTestId('data-mastery')).toContainText('Princip ověřen na celé datové cestě');

    await page.screenshot({ path: 'test-results/data-lab-01-mastery.png', fullPage: true });
  });
});
