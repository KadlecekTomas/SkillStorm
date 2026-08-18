import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PROOF_VIDEO_PATH = join(
  process.cwd(),
  'test-results',
  'proof-videos',
  'skillstorm-data-lab-proof.webm',
);

async function beat(page: Page, milliseconds = 700) {
  await page.waitForTimeout(milliseconds);
}

test.describe('SkillStorm Data Lab proof video', () => {
  test('records the full data → table → query → system → transfer flow', async ({ page }, testInfo) => {
    const video = page.video();
    expect(video, 'Data Lab proof must run with video recording enabled.').not.toBeNull();

    await page.goto('/app/labs/data-lab');
    await expect(page.getByTestId('data-lab-heading')).toBeVisible();
    await beat(page, 1_600);

    // 1. Dirty data is visibly repaired from source evidence.
    await page.getByTestId('data-cell-r3-code').fill('A-103');
    await beat(page, 650);
    await page.getByTestId('data-cell-r4-daysBorrowed').fill('12');
    await beat(page, 650);
    await page.getByTestId('data-cell-r5-borrower').fill('Klára');
    await expect(page.getByTestId('data-clean')).toContainText('konzistentní');
    await beat(page, 1_300);

    // 2. Table rules explain why the validator exists.
    await page.getByTestId('data-stage-rules').scrollIntoViewIfNeeded();
    await beat(page, 850);
    await page.getByTestId('data-rule-unique_id').click();
    await beat(page, 350);
    await page.getByTestId('data-rule-required_borrower').click();
    await beat(page, 350);
    await page.getByTestId('data-rule-days_range').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Schéma chrání');
    await beat(page, 1_250);

    // 3. Query Builder first demonstrates an overly broad rule, then the exact rule.
    await page.getByTestId('data-stage-query').scrollIntoViewIfNeeded();
    await page.getByTestId('data-query-returned-false').click();
    await page.getByTestId('data-query-days-7').click();
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj, Jonáš');
    await beat(page, 1_350);
    await page.getByTestId('data-query-days-14').click();
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj');
    await beat(page, 1_500);

    // 4. Build the information-system data path one semantic stage at a time.
    await page.getByTestId('data-stage-system').scrollIntoViewIfNeeded();
    await beat(page, 900);
    for (const stage of ['input', 'validate', 'store', 'query', 'output']) {
      await page.getByTestId(`data-pipeline-${stage}`).click();
      await beat(page, 600);
    }
    await expect(page.getByTestId('data-pipeline-result')).toContainText('Systém nejdřív přijme data');
    await beat(page, 1_500);

    // 5. Changed-case transfer proves the rule, not memorized completion.
    await page.getByTestId('data-stage-transfer').scrollIntoViewIfNeeded();
    await beat(page, 900);
    await page.getByTestId('data-transfer-t2').click();
    await expect(page.getByTestId('data-transfer-result')).toContainText('počet dní sám o sobě nestačí');
    await beat(page, 1_200);
    await page.getByTestId('data-transfer-t1').click();
    await expect(page.getByTestId('data-mastery')).toContainText('Data → pravidla → dotaz → systém → transfer');
    await page.getByTestId('data-mastery').scrollIntoViewIfNeeded();
    await beat(page, 2_000);

    await mkdir(dirname(PROOF_VIDEO_PATH), { recursive: true });
    await page.close();
    await video!.saveAs(PROOF_VIDEO_PATH);

    const proofVideo = await stat(PROOF_VIDEO_PATH);
    expect(proofVideo.size, 'Data Lab proof video must be a finalized WebM.').toBeGreaterThan(150_000);

    await testInfo.attach('skillstorm-data-lab-proof', {
      path: PROOF_VIDEO_PATH,
      contentType: 'video/webm',
    });
  });
});