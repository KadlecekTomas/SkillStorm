import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Interactive IT Lab — Data Lab', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('proves data cleaning, table rules, query building, system pipeline and transfer', async ({ page }) => {
    await page.goto('/app/labs/data-lab');

    await expect(page.getByTestId('data-lab-heading')).toHaveText('Data Lab');
    await expect(page.getByTestId('data-issues-count')).toHaveText('3');
    await expect(page.getByTestId('data-rule-unique_id')).toBeDisabled();
    await page.screenshot({ path: 'test-results/data-lab-01-dirty.png', fullPage: true });

    // A learner must not be able to alter an already-correct source record to change the later query result.
    await page.getByTestId('data-cell-r2-daysBorrowed').fill('1');
    await expect(page.getByTestId('data-issues-count')).toHaveText('4');
    await expect(page.getByText('Dní neodpovídá zdrojovému podkladu.')).toBeVisible();
    await page.getByTestId('data-cell-r2-daysBorrowed').fill('18');
    await expect(page.getByTestId('data-issues-count')).toHaveText('3');

    // Schema-valid fabricated replacements must not satisfy source-backed evidence.
    await page.getByTestId('data-cell-r3-code').fill('A-999');
    await page.getByTestId('data-cell-r4-daysBorrowed').fill('10');
    await page.getByTestId('data-cell-r5-borrower').fill('Eva');
    await expect(page.getByTestId('data-issues-count')).toHaveText('3');
    await expect(page.getByTestId('data-rule-unique_id')).toBeDisabled();
    await expect(page.getByText('Zdrojový podklad potvrzuje pro Emu ID A-103.')).toBeVisible();

    // Data Detective: source-backed corrections must reduce the actual validator.
    await page.getByTestId('data-cell-r3-code').fill('A-103');
    await expect(page.getByTestId('data-issues-count')).toHaveText('2');
    await page.getByTestId('data-cell-r4-daysBorrowed').fill('12');
    await expect(page.getByTestId('data-issues-count')).toHaveText('1');
    await page.getByTestId('data-cell-r5-borrower').fill('Klára');
    await expect(page.getByTestId('data-clean')).toContainText('konzistentní');
    await expect(page.getByTestId('data-rule-unique_id')).toBeEnabled();
    await page.screenshot({ path: 'test-results/data-lab-02-clean.png', fullPage: true });

    // Table Lab: a superficially strict but invalid rule must not unlock the query.
    await page.getByTestId('data-rule-unique_book').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Ještě ne');
    await expect(page.getByTestId('data-query-returned-false')).toBeDisabled();
    await page.getByTestId('data-rule-unique_book').click();
    await page.getByTestId('data-rule-unique_id').click();
    await page.getByTestId('data-rule-required_borrower').click();
    await page.getByTestId('data-rule-days_range').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Schéma chrání');
    await expect(page.getByTestId('data-query-returned-false')).toBeEnabled();

    // Editing evidence after a downstream checkpoint must invalidate that checkpoint and everything after it.
    await page.getByTestId('data-cell-r2-daysBorrowed').fill('1');
    await expect(page.getByTestId('data-issues-count')).toHaveText('1');
    await expect(page.getByTestId('data-rules-result')).toHaveCount(0);
    await expect(page.getByTestId('data-query-returned-false')).toBeDisabled();
    await page.getByTestId('data-cell-r2-daysBorrowed').fill('18');
    await expect(page.getByTestId('data-clean')).toContainText('konzistentní');
    await expect(page.getByTestId('data-query-returned-false')).toBeDisabled();
    await page.getByTestId('data-rule-unique_id').click();
    await page.getByTestId('data-rule-required_borrower').click();
    await page.getByTestId('data-rule-days_range').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Schéma chrání');
    await expect(page.getByTestId('data-query-returned-false')).toBeEnabled();

    // Query Builder: the result comes from the learner's structured predicates.
    await page.getByTestId('data-query-returned-false').click();
    await page.getByTestId('data-query-days-7').click();
    await expect(page.getByTestId('data-query-result')).toContainText('2 záznamů');
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj, Jonáš');
    await expect(page.getByTestId('data-pipeline-input')).toBeDisabled();

    await page.getByTestId('data-query-days-14').click();
    await expect(page.getByTestId('data-query-result')).toContainText('1 záznamů');
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj');
    await expect(page.getByTestId('data-pipeline-input')).toBeEnabled();
    await page.screenshot({ path: 'test-results/data-lab-03-query.png', fullPage: true });

    // Information System Builder: wrong order is rejected before the canonical pipeline.
    await page.getByTestId('data-pipeline-store').click();
    await page.getByTestId('data-pipeline-input').click();
    await page.getByTestId('data-pipeline-validate').click();
    await page.getByTestId('data-pipeline-query').click();
    await page.getByTestId('data-pipeline-output').click();
    await expect(page.getByTestId('data-pipeline-result')).toContainText('není bezpečná nebo logická');
    await expect(page.getByTestId('data-transfer-t1')).toBeDisabled();

    await page.getByTestId('data-pipeline-clear').click();
    for (const stage of ['input', 'validate', 'store', 'query', 'output']) {
      await page.getByTestId(`data-pipeline-${stage}`).click();
    }
    await expect(page.getByTestId('data-pipeline-result')).toContainText('Systém nejdřív přijme data');
    await expect(page.getByTestId('data-transfer-t1')).toBeEnabled();
    await page.screenshot({ path: 'test-results/data-lab-04-system.png', fullPage: true });

    // Transfer: completion is not mastery. Changed data must be evaluated again.
    await page.getByTestId('data-transfer-t2').click();
    await expect(page.getByTestId('data-transfer-result')).toContainText('počet dní sám o sobě nestačí');
    await expect(page.getByTestId('data-mastery')).toHaveCount(0);

    await page.getByTestId('data-transfer-t1').click();
    await expect(page.getByTestId('data-transfer-result')).toContainText('Tereza splňuje obě podmínky');
    await expect(page.getByTestId('data-mastery')).toContainText('Data → pravidla → dotaz → systém → transfer');
    await page.screenshot({ path: 'test-results/data-lab-05-mastery.png', fullPage: true });
  });
});