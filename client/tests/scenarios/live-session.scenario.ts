import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * BLOK 6 — Bleskovka (live session, režim B).
 *
 * 1. Učitel spustí bleskovku z dashboardu (sada + třída 8.A), projede
 *    3 kola (reveal → outcome), parťák dostane XP, session je FINISHED.
 * 2. XP nejde ovlivnit správností: druhá bleskovka se stejným počtem kol,
 *    ale opačnými výsledky, připíše IDENTICKOU XP deltu.
 *
 * Bezpečnostní invariant po cestě: před revealem není v boardu žádný
 * prvek označený jako správný (server correctKey neposílá).
 */

const SET_TITLE = 'Bleskovka scénář';
const ROUNDS = 3;
/** 3 kola × 10 XP + 50 XP za dokončení — viz live-sessions.constants.ts */
const EXPECTED_DELTA = ROUNDS * 10 + 50;

type Outcome = 'MOSTLY_CORRECT' | 'SPLIT' | 'MOSTLY_WRONG';

async function runBleskovka(
  page: Page,
  class2AId: string,
  outcomes: readonly Outcome[],
): Promise<string> {
  await page.goto('/app', { waitUntil: 'commit' });
  await page.getByTestId('bleskovka-open').click();

  const dialog = page.getByTestId('bleskovka-setup');
  await expect(dialog).toBeVisible();
  await dialog
    .getByTestId('bleskovka-test-select')
    .selectOption({ label: SET_TITLE });
  await dialog.getByTestId('bleskovka-class-select').selectOption(class2AId);
  await dialog.getByTestId('bleskovka-start').click();

  const board = page.getByTestId('live-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('live-round-counter')).toHaveText(
    `Kolo 1/${ROUNDS}`,
  );

  for (const outcome of outcomes) {
    // před revealem nesmí být žádná možnost označená jako správná
    await expect(page.locator('[data-testid^="live-option-"][data-correct]')).toHaveCount(0);

    await page.getByTestId('live-reveal').click();
    await expect(
      page.locator('[data-testid^="live-option-"][data-correct]'),
    ).toHaveCount(1);

    await page.getByTestId(`live-outcome-${outcome}`).click();
  }

  await page.getByTestId('live-finish').click();
  await expect(page.getByTestId('live-finish-screen')).toBeVisible();

  const delta = await page.getByTestId('live-xp-delta').textContent();
  return delta?.trim() ?? '';
}

test.describe.serial('BLOK 6 — Bleskovka (režim B)', () => {
  test('učitel projede 3 kola, parťák dostane XP, session je finished', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('teacher');
    const delta = await runBleskovka(page, manifest.class2AId, [
      'MOSTLY_CORRECT',
      'SPLIT',
      'MOSTLY_WRONG',
    ]);

    expect(delta).toBe(`+${EXPECTED_DELTA} XP`);
    await expect(page.getByTestId('live-partak-stage')).toContainText(
      /úroveň \d+/,
    );

    // Session je FINISHED: návrat na board už nenabízí hru
    const url = page.url();
    await page.goto(url, { waitUntil: 'commit' });
    await expect(
      page.getByRole('heading', { name: /Bleskovka je ukončená/i }),
    ).toBeVisible();
  });

  test('ClassPartak XP nejde ovlivnit správností — opačné výsledky, stejná delta', async ({
    asRole,
    manifest,
  }) => {
    const { page: pageAllCorrect } = await asRole('teacher');
    const deltaAllCorrect = await runBleskovka(
      pageAllCorrect,
      manifest.class2AId,
      ['MOSTLY_CORRECT', 'MOSTLY_CORRECT', 'MOSTLY_CORRECT'],
    );

    const { page: pageAllWrong } = await asRole('teacher');
    const deltaAllWrong = await runBleskovka(
      pageAllWrong,
      manifest.class2AId,
      ['MOSTLY_WRONG', 'MOSTLY_WRONG', 'MOSTLY_WRONG'],
    );

    expect(deltaAllCorrect).toBe(deltaAllWrong);
    expect(deltaAllWrong).toBe(`+${EXPECTED_DELTA} XP`);
  });
});
