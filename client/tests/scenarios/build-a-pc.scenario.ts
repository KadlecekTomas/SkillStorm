import { expect, test } from '@playwright/test';
import { storageStateFor } from './manifest';

test.describe('Interactive IT Lab — Build a PC', () => {
  test.use({ storageState: storageStateFor('student8a') });

  test('student assembles a PC, recovers from a wrong placement and reaches POST', async ({ page }) => {
    await page.goto('/app/labs/build-a-pc');

    await expect(page.getByRole('heading', { name: 'Build a PC · První boot' })).toBeVisible();
    await expect(page.getByTestId('build-progress-label')).toHaveText('0 %');
    await expect(page.getByText('0 pointer streams')).toBeVisible();

    await page.screenshot({ path: 'test-results/build-a-pc-desktop-start.png', fullPage: true });

    await page.getByTestId('component-cpu').click();
    await page.getByTestId('slot-cpu-socket').click();
    await expect(page.getByTestId('build-progress-label')).toHaveText('13 %');

    // Deliberate misconception: RAM is not a PCIe card. The player must reject it
    // without leaking a pointer stream or auto-completing the checkpoint.
    await page.getByTestId('component-ram').click();
    await page.getByTestId('slot-pcie-x16').click();
    await expect(page.getByTestId('build-feedback')).toContainText('Tady to nebude fungovat');
    await expect(page.getByTestId('build-progress-label')).toHaveText('13 %');

    const placements = [
      ['cooler', 'cpu-cooler'],
      ['ram', 'dimm-a2'],
      ['ssd', 'm2-slot'],
      ['gpu', 'pcie-x16'],
      ['psu', 'psu-bay'],
      ['atx24', 'atx24-header'],
      ['eps8', 'eps8-header'],
    ] as const;

    for (const [component, slot] of placements) {
      await page.getByTestId(`component-${component}`).click();
      await page.getByTestId(`slot-${slot}`).click();
    }

    await expect(page.getByTestId('build-progress-label')).toHaveText('100 %');
    await expect(page.getByTestId('checkpoint-label')).toContainText('Připraveno k prvnímu startu');

    await page.getByTestId('power-button').click();
    await expect(page.getByTestId('build-feedback')).toContainText('POST úspěšný', { timeout: 5_000 });
    await expect(page.getByTestId('power-button')).toContainText('POST OK');

    await page.screenshot({ path: 'test-results/build-a-pc-desktop-post-ok.png', fullPage: true });
  });
});
