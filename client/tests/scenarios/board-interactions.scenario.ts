import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * BLOK — Interaktivní tabule (drag & drop kola MATCH_PAIRS / ORDER / SORT_BINS).
 *
 * 1. Celý průchod sadou „Interaktivní tabule scénář" (3 kola) DOTYKEM:
 *    drag simulovaný pointer eventy s pointerType: 'touch'.
 *    - MATCH: špatné spojení se zatřese a vrátí (žádná červená hanba),
 *      správné zapadne; po poslední dvojici oslava + auto-outcome badge.
 *    - ORDER: Zkontrolovat s neseřazenou řadou → špatné pozice se zatřesou;
 *      po seřazení druhá kontrola kolo dokončí.
 *    - SORT: kartičky do košů; XP delta po finish je stejná jako u kvízu
 *      (3 kola × 10 + 50) — pokusy do XP nevstupují.
 *    Bezpečnostní invariant po cestě: projekce nikdy neobsahuje řešení
 *    před dokončením kola (kontrola network odpovědi projekce).
 * 2. Latence školní wifi: throttle 400 ms na attempts → kartička po puštění
 *    zůstane usazená s pending pulzem (žádný spinner), další tah se
 *    NEFRONTUJE za předchozí odpovědí (2 pending kartičky souběžně),
 *    pak obě dostanou verdikt.
 * 3. Ovládací pruh: touch targety ≥ 80 px + fullscreen toggle přítomný.
 */

const SET_TITLE = 'Interaktivní tabule scénář';
const ROUNDS = 3;
const EXPECTED_DELTA = ROUNDS * 10 + 50;

/** Správné páry ze seedu (server je soudí — test je zná ze seed obsahu). */
const MATCH_SOLUTION: Record<string, string> = {
  pes: 'haf',
  kočka: 'mňau',
  kráva: 'bú',
  ovce: 'bé',
};
const ORDER_CORRECT_TEXTS = ['2', '5', '8', '11'];
const SORT_SOLUTION: Record<string, 'Sudá' | 'Lichá'> = {
  '2': 'Sudá',
  '4': 'Sudá',
  '6': 'Sudá',
  '1': 'Lichá',
  '3': 'Lichá',
  '5': 'Lichá',
};

/**
 * Dotykový drag: syntetické PointerEventy s pointerType 'touch' — stejná
 * cesta, kterou jde prst na interaktivní tabuli (engine je pointer-based,
 * žádný HTML5 drag&drop).
 */
async function touchDrag(page: Page, sourceSelector: string, targetSelector: string) {
  await page.waitForSelector(sourceSelector);
  await page.waitForSelector(targetSelector);
  await page.evaluate(
    ([srcSel, tgtSel]) => {
      const src = document.querySelector(srcSel as string);
      const tgt = document.querySelector(tgtSel as string);
      if (!src || !tgt) throw new Error(`touchDrag: missing ${srcSel} / ${tgtSel}`);
      const sr = src.getBoundingClientRect();
      const tr = tgt.getBoundingClientRect();
      const from = { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 };
      const to = { x: tr.x + tr.width / 2, y: tr.y + tr.height / 2 };
      const base = {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
      } as PointerEventInit;
      src.dispatchEvent(
        new PointerEvent('pointerdown', { ...base, clientX: from.x, clientY: from.y }),
      );
      const steps = 6;
      for (let i = 1; i <= steps; i += 1) {
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            ...base,
            clientX: from.x + ((to.x - from.x) * i) / steps,
            clientY: from.y + ((to.y - from.y) * i) / steps,
          }),
        );
      }
      window.dispatchEvent(
        new PointerEvent('pointerup', { ...base, clientX: to.x, clientY: to.y }),
      );
    },
    [sourceSelector, targetSelector],
  );
}

async function startBoardSession(page: Page, classId: string) {
  await page.goto('/app', { waitUntil: 'commit' });
  await page.getByTestId('bleskovka-open').click();
  const dialog = page.getByTestId('bleskovka-setup');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('bleskovka-test-select').selectOption({ label: SET_TITLE });
  await dialog.getByTestId('bleskovka-class-select').selectOption(classId);
  await dialog.getByTestId('bleskovka-start').click();
  await expect(page.getByTestId('live-board')).toBeVisible();
}

/** Mapy „text → testid" pro kartičky a zóny aktuálního kola. */
async function readCards(page: Page, prefix: string): Promise<Record<string, string>> {
  return page.$$eval(
    `[data-testid^="${prefix}"]`,
    (els) =>
      Object.fromEntries(
        els.map((el) => [
          (el.textContent ?? '').replace('✓', '').trim(),
          el.getAttribute('data-testid') as string,
        ]),
      ),
  );
}

async function solveMatchRound(page: Page, opts?: { skipWrongMove?: boolean }) {
  await expect(page.getByTestId('live-match-board')).toBeVisible();

  const zones = await readCards(page, 'live-match-zone-');
  const cards = await readCards(page, 'live-match-card-');

  if (!opts?.skipWrongMove) {
    // Špatné spojení: „mňau" na zónu „pes" → shake a návrat, nic se nezamkne
    const wrongCard = cards['mňau'] as string;
    const pesZoneEntry = Object.entries(zones).find(([text]) => text.includes('pes'));
    await touchDrag(page, `[data-testid="${wrongCard}"]`, `[data-testid="${pesZoneEntry?.[1]}"]`);
    await expect(page.locator('[data-card-state="wrong"]')).toHaveCount(1);
    // po animaci se kartička vrátí do pravého sloupce
    await expect(page.locator(`[data-testid="${wrongCard}"]`)).toBeVisible();
    await expect(page.locator('[data-card-state="wrong"]')).toHaveCount(0);
  }

  for (const [leftText, rightText] of Object.entries(MATCH_SOLUTION)) {
    const freshCards = await readCards(page, 'live-match-card-');
    const zoneEntry = Object.entries(zones).find(([text]) => text.includes(leftText));
    const cardTestId = freshCards[rightText] as string;
    await touchDrag(
      page,
      `[data-testid="${cardTestId}"]`,
      `[data-testid="${zoneEntry?.[1]}"]`,
    );
    // server soudí — počkat na usazení (settled), ne jen na optimistický stav
    await expect(
      page.locator(`[data-testid^="live-match-slot-"][data-card-state="settled"]`),
    ).toHaveCount(
      Object.keys(MATCH_SOLUTION).indexOf(leftText) + 1,
    );
  }
}

async function solveOrderRound(page: Page) {
  await expect(page.getByTestId('live-order-board')).toBeVisible();

  // 1) Zkontrolovat hned — zamíchaná řada → špatné pozice se zatřesou
  await page.getByTestId('live-check-order').click();
  await expect(page.locator('[data-card-state="wrong"]').first()).toBeVisible();
  await expect(page.locator('[data-card-state="wrong"]')).toHaveCount(0);

  // 2) Selection-sort dotykem: pro každou pozici přitáhni správnou kartičku
  for (let position = 0; position < ORDER_CORRECT_TEXTS.length; position += 1) {
    const current = await page.$$eval('[data-testid^="live-order-card-"]', (els) =>
      els.map((el) => ({
        testid: el.getAttribute('data-testid') as string,
        text: (el.textContent ?? '').replace('✓', '').trim(),
      })),
    );
    const expected = ORDER_CORRECT_TEXTS[position] as string;
    const target = current[position];
    const source = current.find((c) => c.text === expected);
    if (!target || !source || target.text === expected) continue;
    await touchDrag(
      page,
      `[data-testid="${source.testid}"]`,
      `[data-testid="${target.testid}"]`,
    );
    await expect(
      page.locator('[data-testid^="live-order-card-"]').nth(position),
    ).toContainText(expected);
  }

  // 3) Druhá kontrola — kolo se dokončí
  await page.getByTestId('live-check-order').click();
}

async function solveSortRound(page: Page) {
  await expect(page.getByTestId('live-sort-board')).toBeVisible();
  const bins = await readCards(page, 'live-sort-bin-');
  const binFor = (label: string) => {
    const entry = Object.entries(bins).find(([text]) => text.includes(label));
    return entry?.[1] as string;
  };

  for (const [cardText, binLabel] of Object.entries(SORT_SOLUTION)) {
    const cards = await readCards(page, 'live-sort-card-');
    const cardTestId = cards[cardText] as string;
    await touchDrag(
      page,
      `[data-testid="${cardTestId}"]`,
      `[data-testid="${binFor(binLabel)}"]`,
    );
    await expect(
      page.locator('[data-testid^="live-sort-placed-"][data-card-state="settled"]'),
    ).toHaveCount(Object.keys(SORT_SOLUTION).indexOf(cardText) + 1);
  }
}

test.describe.serial('Interaktivní tabule — drag & drop kola', () => {
  test('celý průchod dotykem: MATCH → ORDER → SORT, oslavy, auto-outcome, XP delta', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('teacher');

    // Leak guard po cestě: projekční GET nesmí obsahovat řešení
    // nedokončených kol (solution se objeví až po completedAt).
    const leaks: string[] = [];
    page.on('response', (response) => {
      if (!/\/live-sessions\/[0-9a-f-]+$/.test(response.url())) return;
      void response
        .json()
        .then((body: { data?: { rounds?: unknown[] }; rounds?: unknown[] }) => {
          const rounds = (body?.data?.rounds ?? body?.rounds ?? []) as Array<{
            id: string;
            completedAt: string | null;
            solution?: unknown;
          }>;
          for (const r of rounds) {
            if (!r.completedAt && r.solution !== undefined) {
              leaks.push(`řešení nedokončeného kola ${r.id} v projekci`);
            }
          }
        })
        .catch(() => undefined);
    });

    await startBoardSession(page, manifest.class8AId);
    await expect(page.getByTestId('live-round-counter')).toHaveText(`Kolo 1/${ROUNDS}`);

    // ── Kolo 1: MATCH_PAIRS (vč. špatného tahu se shake+návratem) ──
    await solveMatchRound(page);
    await expect(page.getByTestId('live-round-celebration')).toBeVisible();
    // auto-outcome badge: 1 špatný tah ≤ ⌈4/3⌉ → Většina správně
    await expect(
      page.getByTestId('live-outcome-badge-MOSTLY_CORRECT'),
    ).toHaveAttribute('data-active', 'true');
    await page.getByTestId('live-next-round').click();

    // ── Kolo 2: ORDER ──
    await solveOrderRound(page);
    await expect(page.getByTestId('live-round-celebration')).toBeVisible();
    await page.getByTestId('live-next-round').click();

    // ── Kolo 3: SORT_BINS ──
    await solveSortRound(page);
    await expect(page.getByTestId('live-round-celebration')).toBeVisible();

    // ── Finish: XP delta identická s kvízovou cestou (žádný vliv pokusů) ──
    await page.getByTestId('live-finish').click();
    await expect(page.getByTestId('live-finish-screen')).toBeVisible();
    await expect(page.getByTestId('live-xp-delta')).toHaveText(`+${EXPECTED_DELTA} XP`);

    expect(leaks).toEqual([]);
  });

  test('školní wifi (400 ms): pending pulz místo spinneru, tahy se nefrontují', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('teacher');

    // Uměle zpomalená síť jen pro tahy — projekce a ovládání jedou normálně.
    await page.route('**/rounds/*/attempts', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    await startBoardSession(page, manifest.class8AId);
    await expect(page.getByTestId('live-match-board')).toBeVisible();

    const zones = await readCards(page, 'live-match-zone-');
    const cards = await readCards(page, 'live-match-card-');
    const zoneFor = (leftText: string) =>
      Object.entries(zones).find(([text]) => text.includes(leftText))?.[1] as string;

    // 1. tah: kartička zůstane usazená v zóně s pending pulzem
    await touchDrag(
      page,
      `[data-testid="${cards['haf']}"]`,
      `[data-testid="${zoneFor('pes')}"]`,
    );
    await expect(page.locator('[data-card-state="pending"]')).toHaveCount(1);

    // 2. tah OKAMŽITĚ (odpověď prvního ještě letí) → 2 pending souběžně
    await touchDrag(
      page,
      `[data-testid="${cards['mňau']}"]`,
      `[data-testid="${zoneFor('kočka')}"]`,
    );
    await expect(page.locator('[data-card-state="pending"]')).toHaveCount(2);

    // Oba tahy dostanou verdikt (správně → settled), žádný se neztratil
    await expect(
      page.locator('[data-testid^="live-match-slot-"][data-card-state="settled"]'),
    ).toHaveCount(2);
  });

  test('ovládací pruh: touch targety ≥ 80 px, fullscreen toggle', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('teacher');
    await startBoardSession(page, manifest.class8AId);

    const bar = page.getByTestId('live-control-bar');
    await expect(bar).toBeVisible();

    const fullscreen = page.getByTestId('live-fullscreen-toggle');
    await expect(fullscreen).toBeVisible();
    const fsBox = await fullscreen.boundingBox();
    expect(fsBox?.height ?? 0).toBeGreaterThanOrEqual(80);
    expect(fsBox?.width ?? 0).toBeGreaterThanOrEqual(80);

    const solutionBtn = page.getByTestId('live-show-solution');
    const btnBox = await solutionBtn.boundingBox();
    expect(btnBox?.height ?? 0).toBeGreaterThanOrEqual(80);
  });
});
