import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PROOF_VIDEO_PATH = join(
  process.cwd(),
  'test-results',
  'proof-videos',
  'skillstorm-broken-loop-proof.webm',
);

async function beat(page: Page, milliseconds = 700) {
  await page.waitForTimeout(milliseconds);
}

test.describe('SkillStorm product proof video', () => {
  test('records visible Broken Loop execution, diagnosis, repair and transfer', async ({ page }, testInfo) => {
    const video = page.video();
    expect(video, 'Proof scenario must run with Playwright video recording enabled.').not.toBeNull();

    await page.goto('/app/labs/algorithm-lab/block-programming/debug');
    await expect(page.getByRole('heading', { name: 'Broken Loop' })).toBeVisible();
    await beat(page, 1_400);

    // Slow mode is intentional here. This artifact is for a human to understand
    // what the algorithm does, not merely evidence that a click path completed.
    await page.getByTestId('debug-speed-slow').click();
    await beat(page, 500);
    await page.getByTestId('debug-run').click();

    // Let the viewer see the loop execute one iteration at a time. The robot,
    // active source block and trace all advance from the same runtime step.
    await expect(page.getByTestId('debug-trace-step-1')).toBeVisible();
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '1');
    await beat(page, 450);
    await expect(page.getByTestId('debug-trace-step-2')).toBeVisible();
    await beat(page, 450);
    await expect(page.getByTestId('debug-trace-step-3')).toBeVisible();
    await expect(page.getByTestId('debug-active-iteration')).toContainText('3/4');

    await expect(page.getByTestId('debug-failure-evidence')).toContainText('krok 4');
    await expect(page.getByTestId('debug-failure-evidence')).toContainText('blok 1 · opakování 4 · příkaz 1');
    await expect(page.getByTestId('debug-trace-step-4')).toContainText('OBSTACLE');
    await page.getByTestId('debug-repeat-block').scrollIntoViewIfNeeded();
    await beat(page, 1_800);

    // Guessing is rejected. The correct diagnosis is grounded in the trace.
    await page.getByTestId('debug-hypothesis-wrong_turn').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('nevysvětluje');
    await beat(page, 1_300);

    await page.getByTestId('debug-hypothesis-extra_repeat').click();
    await expect(page.getByTestId('debug-diagnosis')).toContainText('Diagnóza sedí s trace');
    await beat(page, 1_300);

    await page.getByTestId('debug-repeat-minus').click();
    await expect(page.getByTestId('debug-repeat-count')).toHaveText('3×');
    await expect(page.getByTestId('debug-repair-status')).toContainText('připraveno k ověření');
    await beat(page, 1_300);

    // Run the repaired algorithm slowly so the complete route is visible rather
    // than teleporting the robot to [4,2].
    await page.getByTestId('debug-run').click();
    await expect(page.getByTestId('debug-trace-step-3')).toBeVisible();
    await beat(page, 500);
    await expect(page.getByTestId('debug-trace-step-6')).toBeVisible();
    await beat(page, 500);
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-x', '4');
    await expect(page.getByTestId('debug-robot')).toHaveAttribute('data-y', '2');
    await expect(page.getByTestId('debug-mission-success')).toContainText('Program už funguje.');
    await page.getByTestId('debug-mission-success').scrollIntoViewIfNeeded();
    await beat(page, 1_800);

    // Completion is not mastery: show a wrong changed-case answer before the
    // correct transfer answer unlocks mastery evidence.
    await page.getByTestId('debug-transfer-4').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Příliš mnoho opakování');
    await expect(page.getByTestId('debug-mastery')).toHaveCount(0);
    await beat(page, 1_200);

    await page.getByTestId('debug-transfer-3').click();
    await expect(page.getByTestId('debug-transfer-result')).toContainText('Správně');
    await expect(page.getByTestId('debug-mastery')).toContainText('Princip ověřen na změněné situaci.');
    await page.getByTestId('debug-mastery').scrollIntoViewIfNeeded();
    await beat(page, 1_800);

    await mkdir(dirname(PROOF_VIDEO_PATH), { recursive: true });
    await page.close();
    await video!.saveAs(PROOF_VIDEO_PATH);

    const proofVideo = await stat(PROOF_VIDEO_PATH);
    expect(proofVideo.size, 'Proof video must contain a finalized WebM recording.').toBeGreaterThan(100_000);

    await testInfo.attach('skillstorm-broken-loop-proof', {
      path: PROOF_VIDEO_PATH,
      contentType: 'video/webm',
    });
  });
});
