import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PROOF_VIDEO_PATH = join(
  process.cwd(),
  'test-results',
  'proof-videos',
  'skillstorm-data-lab-proof.webm',
);

async function beat(page: Page, milliseconds = 900) {
  await page.waitForTimeout(milliseconds);
}

test.describe('SkillStorm Data Lab proof video', () => {
  test('records the full data → table → query → system → transfer flow', async ({ page }, testInfo) => {
    const video = page.video();
    expect(video, 'Data Lab proof must run with video recording enabled.').not.toBeNull();

    await page.goto('/app/labs/data-lab');
    await expect(page.getByTestId('data-lab-heading')).toBeVisible();
    await beat(page, 2_000);

    // 1. Dirty data is repaired from source evidence, and a fabricated repair visibly stays invalid.
    await page.getByTestId('data-cell-r3-code').fill('A-999');
    await expect(page.getByText('Zdrojový podklad potvrzuje pro Emu ID A-103.')).toBeVisible();
    await beat(page, 1_500);
    await page.getByTestId('data-cell-r3-code').fill('A-103');
    await beat(page, 900);
    await page.getByTestId('data-cell-r4-daysBorrowed').fill('12');
    await beat(page, 900);
    await page.getByTestId('data-cell-r5-borrower').fill('Klára');
    await expect(page.getByTestId('data-clean')).toContainText('konzistentní');
    await beat(page, 1_800);

    // 2. Table Lab first rejects a superficially strict rule, then accepts the meaning-preserving rule set.
    await page.getByTestId('data-stage-rules').scrollIntoViewIfNeeded();
    await beat(page, 1_100);
    await page.getByTestId('data-rule-unique_book').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Ještě ne');
    await beat(page, 1_500);
    await page.getByTestId('data-rule-unique_book').click();
    await page.getByTestId('data-rule-unique_id').click();
    await beat(page, 700);
    await page.getByTestId('data-rule-required_borrower').click();
    await beat(page, 700);
    await page.getByTestId('data-rule-days_range').click();
    await expect(page.getByTestId('data-rules-result')).toContainText('Schéma chrání');
    await beat(page, 1_700);

    // 3. Query Builder demonstrates an overly broad query before the exact data-derived reminder rule.
    await page.getByTestId('data-stage-query').scrollIntoViewIfNeeded();
    await beat(page, 1_100);
    await page.getByTestId('data-query-returned-false').click();
    await page.getByTestId('data-query-days-7').click();
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj, Jonáš');
    await beat(page, 1_800);
    await page.getByTestId('data-query-days-14').click();
    await expect(page.getByTestId('data-query-result')).toContainText('Matěj');
    await beat(page, 1_900);

    // 4. Information System Builder visibly rejects unsafe ordering before the canonical pipeline.
    await page.getByTestId('data-stage-system').scrollIntoViewIfNeeded();
    await beat(page, 1_200);
    for (const stage of ['store', 'input', 'validate', 'query', 'output']) {
      await page.getByTestId(`data-pipeline-${stage}`).click();
      await beat(page, 650);
    }
    await expect(page.getByTestId('data-pipeline-result')).toContainText('není bezpečná nebo logická');
    await beat(page, 1_700);
    await page.getByTestId('data-pipeline-clear').click();
    await beat(page, 700);
    for (const stage of ['input', 'validate', 'store', 'query', 'output']) {
      await page.getByTestId(`data-pipeline-${stage}`).click();
      await beat(page, 850);
    }
    await expect(page.getByTestId('data-pipeline-result')).toContainText('Systém nejdřív přijme data');
    await beat(page, 1_900);

    // 5. Changed-case transfer proves the rule, not memorized completion.
    await page.getByTestId('data-stage-transfer').scrollIntoViewIfNeeded();
    await beat(page, 1_200);
    await page.getByTestId('data-transfer-t2').click();
    await expect(page.getByTestId('data-transfer-result')).toContainText('počet dní sám o sobě nestačí');
    await beat(page, 1_600);
    await page.getByTestId('data-transfer-t1').click();
    await expect(page.getByTestId('data-mastery')).toContainText('Data → pravidla → dotaz → systém → transfer');
    await page.getByTestId('data-mastery').scrollIntoViewIfNeeded();
    await beat(page, 2_500);

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