import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

const clickSequence = async (
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  labels: string[],
) => {
  for (const label of labels) {
    await page.getByRole('button', { name: label }).click();
  }
};

test.describe('Interactive IT Lab — Algorithm Lab walkthrough', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('captures the full predict → build → run → diagnose → transfer flow', async ({ page }) => {
    await page.goto('/app/labs/algorithm-lab');

    await expect(page.getByRole('heading', { name: 'Algorithm Lab' })).toBeVisible();
    await expect(page.getByText('Mise 1/2 · Doruč balíček')).toBeVisible();
    await page.screenshot({ path: 'test-results/algorithm-lab-01-start.png', fullPage: true });

    // Deliberately incomplete program: capture the BUILD state before execution.
    await clickSequence(page, ['↑ Krok', '↷ Vpravo', '↑ Krok']);
    await expect(page.getByTestId('algorithm-program')).toContainText('1');
    await page.screenshot({ path: 'test-results/algorithm-lab-02-program-built.png', fullPage: true });

    // RUN + DIAGNOSE: the first attempt must fail with actionable feedback.
    await page.getByRole('button', { name: '▶ Spustit program' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Robot do cíle nedorazil.');
    await page.screenshot({ path: 'test-results/algorithm-lab-03-diagnose.png', fullPage: true });

    // Repair only the algorithm and prove mission 1 success.
    await page.getByRole('button', { name: 'Vymazat' }).click();
    await clickSequence(page, ['↑ Krok', '↑ Krok', '↷ Vpravo', '↑ Krok']);
    await page.getByRole('button', { name: '▶ Spustit program' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.');
    await page.screenshot({ path: 'test-results/algorithm-lab-04-mission-1-success.png', fullPage: true });

    // TRANSFER: move to a different target and solve a new sequence.
    await page.getByRole('button', { name: 'Další mise →' }).click();
    await expect(page.getByText('Mise 2/2 · Obejdi překážku')).toBeVisible();
    await page.screenshot({ path: 'test-results/algorithm-lab-05-transfer-start.png', fullPage: true });

    await clickSequence(page, ['↑ Krok', '↷ Vpravo', '↑ Krok', '↶ Vlevo', '↑ Krok']);
    await page.getByRole('button', { name: '▶ Spustit program' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.');
    await page.screenshot({ path: 'test-results/algorithm-lab-06-transfer-success.png', fullPage: true });
  });

  test('captures a phone-sized student view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/labs/algorithm-lab');
    await expect(page.getByRole('heading', { name: 'Algorithm Lab' })).toBeVisible();
    await page.screenshot({ path: 'test-results/algorithm-lab-07-mobile.png', fullPage: true });
  });
});
