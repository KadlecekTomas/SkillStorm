import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * BLOK 6 — Bleskovka (live session, režim B).
 *
 * 1. Učitel spustí bleskovku z dashboardu (sada + třída 8.A), projede
 *    3 kola (skip hlasování → reveal → outcome), parťák dostane XP,
 *    session je FINISHED.
 * 2. XP nejde ovlivnit správností: druhá bleskovka se stejným počtem kol,
 *    ale opačnými výsledky, připíše IDENTICKOU XP deltu.
 * 3. Hlasování na tabuli: kolo s hlasy → graf → auto-outcome badge →
 *    override jedním klepnutím; další kola přes skip (ruční outcome).
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

    // skip cesta: bez hlasování rovnou reveal → stávající 3 tlačítka
    await page.getByTestId('live-vote-skip').click();
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

  test('hlasování na tabuli: hlasy → graf → auto-outcome → override; skip → ruční outcome', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('teacher');
    await page.goto('/app', { waitUntil: 'commit' });
    await page.getByTestId('bleskovka-open').click();

    const dialog = page.getByTestId('bleskovka-setup');
    await expect(dialog).toBeVisible();
    await dialog
      .getByTestId('bleskovka-test-select')
      .selectOption({ label: SET_TITLE });
    await dialog.getByTestId('bleskovka-class-select').selectOption(manifest.class2AId);
    await dialog.getByTestId('bleskovka-start').click();
    await expect(page.getByTestId('live-board')).toBeVisible();

    // KOLO 1 — hlasování
    await page.getByTestId('live-vote-open').click();
    await expect(page.getByTestId('live-voting')).toBeVisible();

    // mikro-hint prvního použití (auth context nemá localStorage flag)
    await expect(page.getByTestId('live-voting-hint')).toBeVisible();
    await expect(page.getByTestId('live-voting-hint')).toContainText(
      /anonymní/i,
    );
    await page.getByTestId('live-voting-hint-dismiss').click();

    // hlasy: A ×2, B ×1 (mezi tapy na tutéž dlaždici pauza kvůli debounce)
    await page.getByTestId('live-vote-tile-A').click();
    await page.waitForTimeout(350);
    await page.getByTestId('live-vote-tile-A').click();
    await page.getByTestId('live-vote-tile-B').click();
    await expect(page.getByTestId('live-vote-count-A')).toHaveText('2');
    await expect(page.getByTestId('live-vote-count-B')).toHaveText('1');
    await expect(page.getByTestId('live-vote-total')).toContainText('3');

    // debounce dvojkliku: bleskový druhý tap se nepočítá
    await page.waitForTimeout(350);
    await page.getByTestId('live-vote-tile-B').click();
    await page.getByTestId('live-vote-tile-B').click({ delay: 0 });
    await expect(page.getByTestId('live-vote-count-B')).toHaveText('2');

    // před revealem žádný prvek označený jako správný
    await expect(page.locator('[data-correct]')).toHaveCount(0);

    // reveal → graf, právě jeden sloupec správně, auto-outcome badge aktivní
    await page.getByTestId('live-reveal').click();
    await expect(page.getByTestId('live-vote-chart')).toBeVisible();
    await expect(
      page.locator('[data-testid^="live-vote-bar-"][data-correct]'),
    ).toHaveCount(1);
    // A×2 + B×2 (třetí tap na B spolkl debounce)
    await expect(page.getByTestId('live-vote-total')).toContainText('4');
    const activeBadge = page.locator(
      '[data-testid^="live-outcome-badge-"][data-active]',
    );
    await expect(activeBadge).toHaveCount(1);

    // override jedním klepnutím — učitelovo slovo je finální
    const inactive = page
      .locator('[data-testid^="live-outcome-badge-"]:not([data-active])')
      .first();
    const overrideId = await inactive.getAttribute('data-testid');
    await inactive.click();
    await expect(
      page.locator(`[data-testid="${overrideId}"][data-active]`),
    ).toHaveCount(1);
    await expect(activeBadge).toHaveCount(1);

    await page.getByTestId('live-next-round').click();
    await expect(page.getByTestId('live-round-counter')).toHaveText(
      `Kolo 2/${ROUNDS}`,
    );

    // KOLA 2–3 — skip cesta: ruční outcome přes 3 tlačítka
    for (const outcome of ['SPLIT', 'MOSTLY_CORRECT'] as const) {
      await page.getByTestId('live-vote-skip').click();
      await expect(
        page.locator('[data-testid^="live-option-"][data-correct]'),
      ).toHaveCount(1);
      await page.getByTestId(`live-outcome-${outcome}`).click();
    }

    // hlasy nemění XP: pořád stejná delta jako ruční bleskovka
    await page.getByTestId('live-finish').click();
    await expect(page.getByTestId('live-finish-screen')).toBeVisible();
    await expect(page.getByTestId('live-xp-delta')).toHaveText(
      `+${EXPECTED_DELTA} XP`,
    );
  });
});
