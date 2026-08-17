import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { storageStateFor } from './manifest';

const PROOF_VIDEO_PATH = join(
  process.cwd(),
  'test-results',
  'proof-videos',
  'skillstorm-broken-loop-proof.webm',
);

async function beat(page: Page, milliseconds = 550) {
  await page.waitForTimeout(milliseconds);
}

test.describe('SkillStorm product proof video', () => {
  test.use({
    storageState: storageStateFor('student8a'),
    viewport: { width: 1440, height: 900 },
    video: 'on',
  });

  test('records Broken Loop diagnosis, repair and transfer as a reusable CI artifact', async ({ page }, testInfo) => {
    const video = page.video();
    expect(video, 'Proof scenario must run with Playwright video recording enabled.').not.toBeNull();

    await page.goto('/app/labs/algorithm-lab/block-programming/debug');
    await expect(page.getByRole('heading', { name: 'Broken Loop' })).toBeVisible();
    await beat(page, 900);

    // 1. Run the intentionally broken program and expose concrete trace evidence.
    await page.getByTestId('debug-run').click();
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('krok 4');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('blok 1 · opakování 4 · příkaz 1');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('OBSTACLE');
    await page.getByTestId('debug-failure-evidence').scrollIntoViewIfNeeded();
    await beat(page, 1_100);

    // 2. Demonstrate that guessing is rejected by the learning flow.
    await page.getByTestId('debug-hypothesis-wrong_turn').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('nevysvětluje');
    await beat(page, 900);

    // 3. Select the evidence-backed hypothesis and repair the source block.
    await page.getByTestId('debug-hypothesis-extra_repeat').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('Diagnóza sedí s trace');
    await beat(page, 700);

    await page.getByTestId('debug-repeat-minus').click();
    await expect(page.getByTestId('debug-repeat-count')).toHaveText('3×');
    await expect(page.getByTestId('debug-repair-status')).toContainText('připraveno k ověření');
    await beat(page, 900);

    // 4. Re-run the repaired program and prove the robot reaches the target.
    await page.getByTestId('debug-run').click();
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('debug-mission-success')).toContainText('Program už funguje.');
    await page.getByTestId('debug-mission-success').scrollIntoViewIfNeeded();
    await beat(page, 1_100);

    // 5. Show that completion is not mastery: first fail the changed case,
    // then solve it correctly to unlock transfer evidence.
    await page.getByTestId('debug-transfer-4').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Příliš mnoho opakování');
    await expect(page.getByTestId('debug-mastery')).toHaveCount(0);
    await beat(page, 850);

    await page.getByTestId('debug-transfer-3').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Správně');
    await expect(page.getByTestId('debug-mastery')).toContainText('Princip ověřen na změněné situaci.');
    await page.getByTestId('debug-mastery').scrollIntoViewIfNeeded();
    await beat(page, 1_300);

    // Playwright finalizes the video when the page closes. Copy it to a stable
    // artifact path so GitHub Actions does not expose an opaque test-output name.
    await page.close();
    const sourceVideoPath = await video!.path();
    await mkdir(dirname(PROOF_VIDEO_PATH), { recursive: true });
    await copyFile(sourceVideoPath, PROOF_VIDEO_PATH);

    await testInfo.attach('skillstorm-broken-loop-proof', {
      path: PROOF_VIDEO_PATH,
      contentType: 'video/webm',
    });
  });
});
