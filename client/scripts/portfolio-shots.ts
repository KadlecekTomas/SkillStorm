import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * PORTFOLIO SHOTS — opakovatelná sada prezentačních screenshotů (1920×1080,
 * světlé prostředí, čeština, showcase data „ZŠ a Gymnázium Jasmínová").
 * Po každém redesignu stačí: seed:showcase → npm run portfolio:shots.
 *
 * Viz playwright.portfolio.config.ts (předpoklady: běžící dev stack + seed).
 *
 * Vedlejší efekty v showcase datech (seed:showcase je při dalším běhu vrátí):
 *   - bleskovky zůstávají RUNNING (záměrně se nedokončují),
 *   - VÝJIMKA: jedna expediční session 2.B se dokončí kvůli záběru XP scény
 *     na konci Výpravy → posune Výpravu 4/8 → 5/8. Mapa (09) se fotí PŘED
 *     tímto krokem, v rámci jednoho běhu tedy vždy ukazuje 4/8.
 *   → před každým během skriptu proto VŽDY znovu spustit seed:showcase.
 *
 * Kategorie záběrů (viz docs/screenshots/portfolio/index.md):
 *   01–14  celé obrazovky (hero + sekce), 15–16 párové záběry,
 *   17–20  detailní výřezy 1200×800 pro landing page.
 */

const OUT = resolve(__dirname, '..', '..', 'docs', 'screenshots', 'portfolio');
const PASSWORD = 'Password123!';

const ACCOUNTS = {
  teacher: 'ucitel@jasminova.test',
  director: 'reditel@jasminova.test',
  studentYoung: 'zak2b@jasminova.test',
  studentOld: 'zak8a@jasminova.test',
} as const;

async function login(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app**', { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

async function settle(page: Page, ms = 2000) {
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string, opts?: { fullPage?: boolean }) {
  await page.screenshot({
    path: join(OUT, `${name}.png`),
    fullPage: opts?.fullPage ?? false,
    animations: 'disabled',
  });
  console.log(`📸 ${name}`);
}

/**
 * Pixel-perfect kontrola pro hero záběry: doběhlé fonty, žádné toasty,
 * žádný scrollbar ani horizontální přetečení, kurzor mimo záběr.
 * Horizontální přetečení běh SHODÍ — hero záběr s posuvníkem je zmetek.
 */
async function heroPreflight(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.addStyleTag({
    content: '::-webkit-scrollbar{display:none!important}',
  });
  await page.evaluate(() => {
    document
      .querySelectorAll('.Toastify__toast, [data-sonner-toast]')
      .forEach((el) => el.remove());
  });
  const overflowX = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (overflowX > 0) {
    throw new Error(`HERO kontrola: horizontální přetečení ${overflowX}px`);
  }
  const truncated = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => (el.textContent ?? '').trim().slice(0, 60)),
  );
  if (truncated.length) {
    console.warn(`⚠️  HERO kontrola — oříznuté nadpisy: ${truncated.join(' | ')}`);
  }
  await page.mouse.move(0, 0);
}

/**
 * Detailní výřez 1200×800 vycentrovaný na element (pro landing page).
 * `hideChrome` schová sidebar a horní lištu — detail nemá zachytávat shell.
 */
async function clipShot(
  page: Page,
  locator: Locator,
  name: string,
  opts?: { hideChrome?: boolean },
  size = { width: 1200, height: 800 },
) {
  if (opts?.hideChrome) {
    await page.addStyleTag({
      content:
        'aside{display:none!important} main > header{display:none!important} [data-app-chrome]{display:none!important}',
    });
    await settle(page, 400);
  }
  await locator.scrollIntoViewIfNeeded();
  await settle(page, 400);
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) {
    console.warn(`⚠️  výřez ${name}: element nenalezen — přeskočeno`);
    return;
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x = Math.max(0, Math.min(cx - size.width / 2, vp.width - size.width));
  const y = Math.max(0, Math.min(cy - size.height / 2, vp.height - size.height));
  await page.screenshot({
    path: join(OUT, `${name}.png`),
    clip: { x, y, width: size.width, height: size.height },
    animations: 'disabled',
  });
  console.log(`🔍 ${name} (1200×800)`);
}

/**
 * Otevře dialog Bleskovky a spustí session; vrátí až po naběhnutí boardu.
 * `campaign: true` vybere aktivní kampaň třídy (option s UUID hodnotou).
 */
async function startBleskovka(
  page: Page,
  setLabel: string,
  classLabel: string,
  ageTestId?: 'young' | 'middle' | 'senior',
  campaign = false,
) {
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('bleskovka-open').click();
  const dialog = page.getByTestId('bleskovka-setup');
  await expect(dialog).toBeVisible();
  await dialog
    .getByTestId('bleskovka-test-select')
    .selectOption({ label: setLabel });
  await dialog
    .getByTestId('bleskovka-class-select')
    .selectOption({ label: classLabel });
  if (campaign) {
    const select = dialog.getByTestId('bleskovka-campaign-select');
    const id = await select.locator('option').evaluateAll((opts) => {
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const hit = opts.find((o) => uuid.test((o as HTMLOptionElement).value));
      return (hit as HTMLOptionElement | undefined)?.value ?? '';
    });
    if (id) await select.selectOption(id);
  }
  if (ageTestId) {
    await dialog.getByTestId(`bleskovka-age-${ageTestId}`).click();
  }
  await dialog.getByTestId('bleskovka-start').click();
  await expect(page.getByTestId('live-board')).toBeVisible({ timeout: 20_000 });
  await settle(page, 1200);
}

/** Přečte id kampaňového progressu z options selectu v dialogu Bleskovky. */
async function campaignProgressIdFor(page: Page, classLabel: string) {
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('bleskovka-open').click();
  const dialog = page.getByTestId('bleskovka-setup');
  await dialog
    .getByTestId('bleskovka-class-select')
    .selectOption({ label: classLabel });
  const select = dialog.getByTestId('bleskovka-campaign-select');
  await expect(select).toBeVisible();
  const id = await select.locator('option').evaluateAll((opts) => {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const hit = opts.find((o) => uuid.test((o as HTMLOptionElement).value));
    return (hit as HTMLOptionElement | undefined)?.value ?? '';
  });
  await page.keyboard.press('Escape');
  return id;
}

/**
 * Zadání → detail NEodevzdaného → „Spustit test" → focus stránka.
 * `titlePattern` vybere kartu konkrétního testu (jinak první dostupná).
 */
async function openFirstAssignmentTest(
  page: Page,
  titlePattern?: RegExp,
): Promise<boolean> {
  await page.goto('/app/assignments', { waitUntil: 'domcontentloaded' });
  await settle(page);
  // Řádky nejsou <a> — tlačítko „Otevřít test" pushuje na detail zadání.
  // Kartu vybíráme jako NEJVNITŘNĚJŠÍ div s názvem testu i tlačítkem (.last()).
  const openBtn = (
    titlePattern
      ? page
          .locator('div')
          .filter({ hasText: titlePattern })
          .filter({ has: page.getByRole('button', { name: /otevřít test/i }) })
          .last()
      : page
  )
    .getByRole('button', { name: /otevřít test/i })
    .first();
  try {
    await openBtn.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    return false;
  }
  await openBtn.click();
  const start = page.getByRole('button', { name: /spustit test/i });
  try {
    await start.waitFor({ state: 'visible', timeout: 8000 });
    await start.click();
    await page.waitForURL('**/test**', { timeout: 20_000 });
    return true;
  } catch {
    console.warn('Zadání nejde spustit — screenshot vynechán.');
    return false;
  }
}

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

test('portfolio — student old (dashboard + výřezy + časovač)', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page, ACCOUNTS.studentOld);
  await settle(page);
  await shot(page, '01-student-dashboard-partak');

  // Detailní výřezy z hero karty: parťák + streak pilulky (bez app shellu)
  await clipShot(
    page,
    page.getByTestId('student-hero-card'),
    '17-detail-partak-hero-karta',
    { hideChrome: true },
  );
  await clipShot(
    page,
    page.getByTestId('student-hero-badges'),
    '18-detail-streak-pilulky',
    { hideChrome: true },
  );

  // Old test s časovačem (⏱ 15 min): cíleně „Rovnice o jedné neznámé" —
  // „Procenta kolem nás" nemají limit a ukázala by jen „Konec za 18 dní".
  const opened = await openFirstAssignmentTest(page, /Rovnice o jedné neznámé/);
  if (opened) {
    await settle(page, 2500);
    await shot(page, '03-student-test-old-casovac');
  }
  await context.close();
});

test('portfolio — student young (dlaždice + párový desktop dashboard)', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page, ACCOUNTS.studentYoung);
  await settle(page);
  // Párový záběr k 12-mobil-student-dashboard (stejná žákyně, desktop)
  await shot(page, '16-par-student-dashboard-desktop');

  const opened = await openFirstAssignmentTest(page);
  if (opened) {
    await settle(page, 2500);
    await shot(page, '02-student-test-young-dlazdice');
  }
  await context.close();
});

test('portfolio — učitel', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page, ACCOUNTS.teacher);
  await settle(page);
  await shot(page, '04-teacher-dashboard');

  // Builder krok 2 (best effort — wizard se může vyvíjet)
  try {
    await page.goto('/app/tests/create', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const title = page.locator('input[type="text"]').first();
    await title.fill('Přírodopis — ptáci našich lesů');
    const next = page.getByRole('button', {
      name: /pokračovat|další|next/i,
    });
    if (await next.count()) {
      await next.first().click();
      await settle(page, 1500);
    }
    await shot(page, '05-teacher-test-builder-krok2');
  } catch {
    console.warn('builder krok 2 se nepovedl — screenshot kroku 1');
    await shot(page, '05-teacher-test-builder-krok2');
  }

  // Kampaňové projekce — mapa Výpravy je HERO záběr a fotí se PŘED
  // dokončením expediční session (jinak by ukazovala 5/8).
  const expeditionId = await campaignProgressIdFor(page, '2.B');
  if (expeditionId) {
    await page.goto(`/app/campaigns/${expeditionId}/board`, {
      waitUntil: 'domcontentloaded',
    });
    await settle(page, 2500);
    await heroPreflight(page);
    await shot(page, '09-vyprava-mapa-samolepky', { fullPage: true });
  }
  const missionId = await campaignProgressIdFor(page, '8.A');
  if (missionId) {
    await page.goto(`/app/campaigns/${missionId}/board`, {
      waitUntil: 'domcontentloaded',
    });
    await settle(page, 2500);
    await shot(page, '10-archiv-nastenka-fragment', { fullPage: true });
    // Zapečetěný vzkaz od loňské 9.A — detail, který vypráví (best effort)
    try {
      await page
        .getByRole('button', { name: /přečíst si vzkaz/i })
        .click({ timeout: 4000 });
      await settle(page, 1200);
      await shot(page, '10b-archiv-vzkaz-lonske-9a');
      await page.keyboard.press('Escape');
    } catch {
      console.warn('vzkaz 9.A se nepodařilo otevřít — záběr vynechán');
    }
  }

  // Bleskovka boardy — young / middle / senior (sessions zůstávají RUNNING)
  await startBleskovka(page, 'Vyjmenovaná slova po B a L', '2.B', 'young');
  await page
    .getByTestId('expedition-intro-start')
    .click({ timeout: 3000 })
    .catch(() => {});
  await settle(page, 800);
  await page.getByTestId('live-reveal').click();
  await settle(page, 900);
  await shot(page, '06-bleskovka-young');
  // Detailní výřez: taktilní dlaždice s outcome po reveal (rodič = grid)
  await clipShot(
    page,
    page.locator('[data-testid^="live-outcome-"]').first().locator('..'),
    '19-detail-tactile-outcome',
  );

  await startBleskovka(page, 'Vyjmenovaná slova po B a L', '5.A', 'middle');
  await page.getByTestId('live-reveal').click();
  await settle(page, 900);
  await shot(page, '07-bleskovka-middle');

  await startBleskovka(page, 'Literární moderna', 'G2', 'senior');
  await page.getByTestId('live-reveal').click();
  await settle(page, 900);
  await heroPreflight(page);
  await shot(page, '08-bleskovka-senior');

  // Párový záběr: STEJNÁ sada (a otázka — shuffle je vypnutý) jako young
  // board 06, jen v senior quiz-night režimu → příběh „roste s dětmi".
  await startBleskovka(page, 'Vyjmenovaná slova po B a L', '5.A', 'senior');
  await page.getByTestId('live-reveal').click();
  await settle(page, 900);
  await shot(page, '15-par-bleskovka-senior');

  // XP scéna na konci Výpravy: expediční session 2.B → odehrát VŠECHNA kola
  // (live-finish se ukáže až po posledním outcome) → dokončit.
  // POZOR: posouvá Výpravu 4/8 → 5/8 (proto se mapa fotila výše).
  await startBleskovka(
    page,
    'Vyjmenovaná slova po B a L',
    '2.B',
    'young',
    true,
  );
  await page
    .getByTestId('expedition-intro-start')
    .click({ timeout: 3000 })
    .catch(() => {});
  await settle(page, 800);
  for (let i = 0; i < 10; i += 1) {
    if (await page.getByTestId('live-finish').isVisible().catch(() => false)) {
      break;
    }
    await page.getByTestId('live-reveal').click();
    await settle(page, 700);
    // realistický mix výsledků: druhé kolo „smíšeně", jinak „většina správně"
    const preferred = page.getByTestId(
      i === 1 ? 'live-outcome-MIXED' : 'live-outcome-MOSTLY_CORRECT',
    );
    if (await preferred.isVisible().catch(() => false)) {
      await preferred.click();
    } else {
      await page.locator('[data-testid^="live-outcome-"]').first().click();
    }
    await settle(page, 700);
  }
  await page.getByTestId('live-finish').click();
  await expect(page.getByTestId('live-finish-screen')).toBeVisible({
    timeout: 15_000,
  });
  // nechat doběhnout XP bar (300 ms delay + 1500 ms animace)
  await settle(page, 2500);
  await clipShot(
    page,
    page.getByTestId('live-xp-delta').locator('..'),
    '20-detail-xp-konec-vypravy',
  );

  await context.close();
});

test('portfolio — ředitelka', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page, ACCOUNTS.director);
  await settle(page, 2500);
  await heroPreflight(page);
  await shot(page, '11-director-analytika');
  await context.close();
});

test('portfolio — mobilní student flow (390px, 3 obrazovky)', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await login(page, ACCOUNTS.studentYoung);
  await settle(page);
  await shot(page, '12-mobil-student-dashboard');

  await page.goto('/app/assignments', { waitUntil: 'domcontentloaded' });
  await settle(page);
  await shot(page, '13-mobil-student-zadani');

  const opened = await openFirstAssignmentTest(page);
  if (opened) {
    await settle(page, 2500);
    await shot(page, '14-mobil-student-test');
  }
  await context.close();
});

/**
 * BONUS: device frame (browser chrome mockup) pro nejlepší záběry.
 * Rámeček je čisté HTML/CSS — žádná závislost, žádná cizí grafika.
 * Podklad: světlý neutrální token --canvas-alt (#fbfaf8), jemný stín
 * z barvy inkoustu (#37352f) dle design systému — žádné gradienty.
 */
const FRAMED: Array<{ file: string; url: string }> = [
  { file: '01-student-dashboard-partak', url: 'skillstorm.app/app' },
  { file: '04-teacher-dashboard', url: 'skillstorm.app/app' },
  { file: '08-bleskovka-senior', url: 'skillstorm.app/app/live' },
  { file: '09-vyprava-mapa-samolepky', url: 'skillstorm.app/app/campaigns' },
  { file: '11-director-analytika', url: 'skillstorm.app/app' },
];

test('portfolio — device frame varianty', async ({ browser }) => {
  const framePage = (imgPath: string, url: string) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 64px; background: #fbfaf8; /* --canvas-alt */
         display: grid; place-items: center; min-height: 100vh; box-sizing: border-box; }
  .frame { width: 1560px; border-radius: 14px; overflow: hidden; background: #fff;
           border: 1px solid #e9e7e2; /* --line */
           box-shadow: 0 18px 40px rgba(55, 53, 47, .10), 0 2px 8px rgba(55, 53, 47, .06); }
  .bar { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px;
         background: #fbfaf8; border-bottom: 1px solid #e9e7e2; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .addr { flex: 1; margin: 0 40px; height: 26px; border-radius: 13px; background: #fff;
          border: 1px solid #e9e7e2; color: #6f6b62; font: 500 12px/26px -apple-system, sans-serif;
          text-align: center; }
  img { display: block; width: 100%; }
</style></head><body>
  <div class="frame">
    <div class="bar">
      <span class="dot" style="background:#ff5f57"></span>
      <span class="dot" style="background:#febc2e"></span>
      <span class="dot" style="background:#28c840"></span>
      <div class="addr">${url}</div>
    </div>
    <img src="file://${imgPath}" />
  </div>
</body></html>`;

  const context = await browser.newContext({
    viewport: { width: 1728, height: 1220 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const item of FRAMED) {
    const imgPath = join(OUT, `${item.file}.png`);
    const html = framePage(imgPath, item.url);
    const tmp = join(OUT, `.frame-${item.file}.html`);
    writeFileSync(tmp, html);
    await page.goto(`file://${tmp}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `${item.file}.framed.png`) });
    console.log(`🖼️  ${item.file}.framed`);
  }
  await context.close();
});
