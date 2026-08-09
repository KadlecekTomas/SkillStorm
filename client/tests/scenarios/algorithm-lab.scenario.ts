import { expect, test, type Page } from '@playwright/test';
import { storageStateFor } from './manifest';

const clickSequence = async (page: Page, labels: string[]) => {
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
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-x', '0');
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-direction', 'EAST');
    await page.screenshot({ path: 'test-results/algorithm-lab-01-start.png', fullPage: true });

    // Deliberately incomplete program: capture the BUILD state before execution.
    await clickSequence(page, ['↑ Krok', '↷ Vpravo', '↑ Krok']);
    await expect(page.getByTestId('algorithm-program')).toContainText('1');
    await page.screenshot({ path: 'test-results/algorithm-lab-02-program-built.png', fullPage: true });

    // RUN + DIAGNOSE: prove that commands are really executed and leave the robot
    // at the computed position instead of merely comparing arrays.
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Robot do cíle nedorazil.', { timeout: 8_000 });
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-x', '1');
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-y', '1');
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-direction', 'SOUTH');
    await expect(page.getByTestId('algorithm-result')).toContainText('Program skončil na [1, 1]');
    await page.screenshot({ path: 'test-results/algorithm-lab-03-diagnose.png', fullPage: true });

    // Repair the algorithm and prove mission 1 success from actual final position.
    await page.getByRole('button', { name: 'Vymazat' }).click();
    await clickSequence(page, ['↑ Krok', '↑ Krok', '↷ Vpravo', '↑ Krok']);
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.', { timeout: 8_000 });
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-x', '2');
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-y', '1');
    await page.screenshot({ path: 'test-results/algorithm-lab-04-mission-1-success.png', fullPage: true });

    // TRANSFER: the second mission introduces a real obstacle. A direct forward
    // command must fail specifically at step 1 before the correct detour works.
    await page.getByRole('button', { name: 'Další mise →' }).click();
    await expect(page.getByText('Mise 2/2 · Obejdi překážku')).toBeVisible();
    await page.screenshot({ path: 'test-results/algorithm-lab-05-transfer-start.png', fullPage: true });

    await page.getByRole('button', { name: '↑ Krok' }).click();
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Krok 1 vede přímo do překážky', { timeout: 5_000 });
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-x', '0');

    await page.getByRole('button', { name: 'Vymazat' }).click();
    await clickSequence(page, ['↷ Vpravo', '↑ Krok', '↶ Vlevo', '↑ Krok', '↑ Krok']);
    await page.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();
    await expect(page.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.', { timeout: 8_000 });
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-x', '2');
    await expect(page.getByTestId('algorithm-robot')).toHaveAttribute('data-y', '1');
    await page.screenshot({ path: 'test-results/algorithm-lab-06-transfer-success.png', fullPage: true });
  });

  test('captures a phone-sized student view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/labs/algorithm-lab');
    await expect(page.getByRole('heading', { name: 'Algorithm Lab' })).toBeVisible();
    await page.screenshot({ path: 'test-results/algorithm-lab-07-mobile.png', fullPage: true });
  });
});
