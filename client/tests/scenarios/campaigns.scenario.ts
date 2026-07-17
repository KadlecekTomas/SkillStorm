import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Kampaně (Výprava/Mise) — meziherní vrstva nad bleskovkami.
 *
 * 1. Výprava (2.A): dvě bleskovky za sebou → postup přesně o 2 zastávky,
 *    samolepky přibývají, po finishi se zobrazil háček. Sessiony mají
 *    OPAČNÉ outcomes → obě posunuly o stejný 1 krok (správnost nerozhoduje).
 * 2. Mise (8.A): kapitola odemkne fragment, nástěnka ho ukazuje; druhá
 *    kapitola s opačnými outcomes → identický postup (+1).
 *
 * Screenshoty pro PR se ukládají do test-results/campaign-shots/.
 */

const SET_TITLE = 'Bleskovka scénář';
const ROUNDS = 3;

type Outcome = 'MOSTLY_CORRECT' | 'SPLIT' | 'MOSTLY_WRONG';

const SHOT_DIR = 'test-results/campaign-shots';

/**
 * Otevře dialog, vybere sadu + třídu a kampaň. `campaignChoice` je hodnota
 * option: "new:<slug>" pro novou, jinak id progressu (pokračovat).
 * Vrací hodnotu vybrané volby (u "new:" tu zjistíme progressId až po startu).
 */
async function startCampaignSession(
  page: Page,
  classId: string,
  campaignChoice: 'new' | 'continue',
  slug: string,
): Promise<string> {
  await page.goto('/app', { waitUntil: 'commit' });
  await page.getByTestId('bleskovka-open').click();

  const dialog = page.getByTestId('bleskovka-setup');
  await expect(dialog).toBeVisible();
  await dialog
    .getByTestId('bleskovka-test-select')
    .selectOption({ label: SET_TITLE });
  await dialog.getByTestId('bleskovka-class-select').selectOption(classId);

  const campaignSelect = dialog.getByTestId('bleskovka-campaign-select');
  await expect(campaignSelect).toBeVisible();

  let choiceValue: string;
  if (campaignChoice === 'new') {
    choiceValue = `new:${slug}`;
  } else {
    // pokračování: option s value = UUID progressu
    choiceValue = await campaignSelect
      .locator('option')
      .evaluateAll((opts) => {
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        const hit = opts.find((o) =>
          uuid.test((o as HTMLOptionElement).value),
        ) as HTMLOptionElement | undefined;
        return hit?.value ?? '';
      });
    expect(choiceValue).not.toBe('');
  }
  await campaignSelect.selectOption(choiceValue);
  await dialog.getByTestId('bleskovka-start').click();
  return choiceValue;
}

async function playRounds(page: Page, outcomes: readonly Outcome[]) {
  for (const outcome of outcomes) {
    // invariant enginu platí i v kampani: před revealem žádný správný klíč
    await expect(
      page.locator('[data-testid^="live-option-"][data-correct]'),
    ).toHaveCount(0);
    await page.getByTestId('live-reveal').click();
    await expect(
      page.locator('[data-testid^="live-option-"][data-correct]'),
    ).toHaveCount(1);
    await page.getByTestId(`live-outcome-${outcome}`).click();
  }
  await page.getByTestId('live-finish').click();
  await expect(page.getByTestId('live-finish-screen')).toBeVisible();
}

test.describe.serial('Kampaně — Výprava a Mise nad bleskovkami', () => {
  let expeditionProgressId = '';
  let missionProgressId = '';

  test('Výprava: 2 bleskovky → +2 zastávky, samolepky přibývají, háček se zobrazil', async ({
    asRole,
    manifest,
  }) => {
    // ---- Bleskovka 1 (vše správně) ----
    const { page } = await asRole('teacher');
    await startCampaignSession(page, manifest.class2AId, 'new', 'vyprava-svetluska');

    // Před bleskovkou: mapa s parťákem a dnešním cílem
    const intro = page.getByTestId('expedition-intro');
    await expect(intro).toBeVisible();
    await expect(intro.getByTestId('expedition-map')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/01-expedition-map-start.png` });
    await intro.getByTestId('expedition-intro-start').click();

    // Během kol parťák poposkakuje po úseku (strip existuje)
    await expect(page.getByTestId('expedition-strip')).toBeVisible();
    await playRounds(page, ['MOSTLY_CORRECT', 'MOSTLY_CORRECT', 'MOSTLY_CORRECT']);

    // Scéna nálezu: zastávka 1, samolepka, HÁČEK
    const scene = page.getByTestId('expedition-finish-scene');
    await expect(scene).toBeVisible();
    await expect(scene.getByTestId('expedition-sticker-earned')).toBeVisible();
    await expect(scene.getByTestId('expedition-hook')).toBeVisible();
    await expect(
      scene.locator('[data-testid="map-stop-1"][data-state="unlocked"]'),
    ).toHaveCount(1);
    await expect(
      scene.locator('[data-testid="map-stop-2"][data-state="next"]'),
    ).toHaveCount(1);
    await page.screenshot({
      path: `${SHOT_DIR}/02-expedition-finish-stop1.png`,
      fullPage: true,
    });

    // ---- Bleskovka 2 (vše špatně — postup musí být stejný: +1) ----
    const { page: page2 } = await asRole('teacher');
    expeditionProgressId = await startCampaignSession(
      page2,
      manifest.class2AId,
      'continue',
      'vyprava-svetluska',
    );
    await page2.getByTestId('expedition-intro-start').click();
    await playRounds(page2, ['MOSTLY_WRONG', 'MOSTLY_WRONG', 'MOSTLY_WRONG']);
    await expect(
      page2
        .getByTestId('expedition-finish-scene')
        .locator('[data-testid="map-stop-2"][data-state="unlocked"]'),
    ).toHaveCount(1);

    // ---- Kampaňová projekce: pozice 2/8, sbírka má právě 2 samolepky ----
    await page2.goto(`/app/campaigns/${expeditionProgressId}/board`, {
      waitUntil: 'commit',
    });
    const board = page2.getByTestId('campaign-board');
    await expect(board).toBeVisible();
    await expect(page2.getByTestId('campaign-position')).toContainText(
      'Zastávka 2 z 8',
    );
    await expect(
      page2.locator('[data-testid^="sticker-"][data-state="unlocked"]'),
    ).toHaveCount(2);
    await expect(
      page2.locator('[data-testid="sticker-3"][data-state="locked"]'),
    ).toHaveCount(1);
    await page2.screenshot({
      path: `${SHOT_DIR}/03-expedition-board-stickers.png`,
      fullPage: true,
    });
  });

  test('Mise: kapitola odemkne fragment, nástěnka ho ukazuje, opačné outcomes → identický postup', async ({
    asRole,
    manifest,
  }) => {
    // ---- Kapitola 1 (vše správně) ----
    const { page } = await asRole('teacher');
    await startCampaignSession(page, manifest.class8AId, 'new', 'mise-archiv');

    // Mise jede v tmavé scéně se signálem; hodnota roste jen s koly
    const board = page.getByTestId('live-board');
    await expect(board).toBeVisible();
    const signal = page.getByTestId('mission-signal');
    await expect(signal).toBeVisible();
    await expect(signal).toHaveAttribute('data-fraction', '0.00');
    await page.screenshot({ path: `${SHOT_DIR}/04-mission-board.png` });

    await playRounds(page, ['MOSTLY_CORRECT', 'MOSTLY_CORRECT', 'MOSTLY_CORRECT']);

    // Konec kapitoly: fragment + cliffhanger + POKRAČOVÁNÍ PŘÍŠTĚ
    const scene = page.getByTestId('mission-finish-scene');
    await expect(scene).toBeVisible();
    await expect(scene.getByTestId('mission-fragment')).toBeVisible();
    await expect(scene.getByTestId('mission-cliffhanger')).toBeVisible();
    await expect(scene.getByTestId('mission-to-be-continued')).toContainText(
      /pokračování příště/i,
    );
    await page.screenshot({
      path: `${SHOT_DIR}/05-mission-fragment-unlocked.png`,
      fullPage: true,
    });

    // ---- Kapitola 2 (vše špatně — identický postup: +1 kapitola) ----
    const { page: page2 } = await asRole('teacher');
    missionProgressId = await startCampaignSession(
      page2,
      manifest.class8AId,
      'continue',
      'mise-archiv',
    );
    await playRounds(page2, ['MOSTLY_WRONG', 'MOSTLY_WRONG', 'MOSTLY_WRONG']);
    await expect(page2.getByTestId('mission-finish-scene')).toContainText(
      /fragment 2\/3/i,
    );

    // ---- Nástěnka: fragmenty 1+2 čitelné, 3 zašifrovaný ----
    await page2.goto(`/app/campaigns/${missionProgressId}/board`, {
      waitUntil: 'commit',
    });
    await expect(page2.getByTestId('campaign-board')).toBeVisible();
    await expect(page2.getByTestId('campaign-position')).toContainText(
      /kapitola 2 \/ 3/i,
    );
    await expect(
      page2.locator('[data-testid^="fragment-"][data-state="unlocked"]'),
    ).toHaveCount(2);
    await expect(
      page2.locator('[data-testid="fragment-3"][data-state="locked"]'),
    ).toHaveCount(1);
    await page2.screenshot({
      path: `${SHOT_DIR}/06-mission-fragment-wall.png`,
      fullPage: true,
    });
  });
});
