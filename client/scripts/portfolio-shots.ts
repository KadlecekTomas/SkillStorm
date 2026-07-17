import { test, expect, type Page, type Browser } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * PORTFOLIO SHOTS — opakovatelná sada prezentačních screenshotů (1920×1080,
 * světlé prostředí, čeština, showcase data „ZŠ a Gymnázium Jasmínová").
 * Po každém redesignu stačí: seed:showcase → npm run portfolio:shots.
 *
 * Viz playwright.portfolio.config.ts (předpoklady: běžící dev stack + seed).
 *
 * Vedlejší efekty v showcase datech: skript zakládá bleskovky (zůstávají
 * RUNNING — záměrně se nedokončují, aby neposouvaly kampaně ani XP).
 * seed:showcase je při dalším běhu smaže.
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

/** Otevře dialog Bleskovky a spustí session; vrátí až po naběhnutí boardu. */
async function startBleskovka(
  page: Page,
  setLabel: string,
  classLabel: string,
  ageTestId?: 'young' | 'middle' | 'senior',
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

/** Zadání → detail prvního NEodevzdaného → „Spustit test" → focus stránka. */
async function openFirstAssignmentTest(page: Page): Promise<boolean> {
  await page.goto('/app/assignments', { waitUntil: 'domcontentloaded' });
  await settle(page);
  // Řádky nejsou <a> — tlačítko „Otevřít test" pushuje na detail zadání.
  const openBtn = page.getByRole('button', { name: /otevřít test/i }).first();
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

test('portfolio — student old', async ({ browser }) => {
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await login(page, ACCOUNTS.studentOld);
    await settle(page);
    await shot(page, '01-student-dashboard-partak');

    // Old test s časovačem: zadání → detail → Spustit test
    const opened = await openFirstAssignmentTest(page);
    if (opened) {
      await settle(page, 2500);
      await shot(page, '03-student-test-old-casovac');
    }
    await context.close();
  }

});

test('portfolio — student young', async ({ browser }) => {
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await login(page, ACCOUNTS.studentYoung);
    const opened = await openFirstAssignmentTest(page);
    if (opened) {
      await settle(page, 2500);
      await shot(page, '02-student-test-young-dlazdice');
    }
    await context.close();
  }

});

test('portfolio — učitel', async ({ browser }) => {
  {
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

    // Kampaňové projekce (id z dialogu Bleskovky)
    const expeditionId = await campaignProgressIdFor(page, '2.B');
    if (expeditionId) {
      await page.goto(`/app/campaigns/${expeditionId}/board`, {
        waitUntil: 'domcontentloaded',
      });
      await settle(page, 2500);
      await shot(page, '09-vyprava-mapa-samolepky', { fullPage: true });
    }
    const missionId = await campaignProgressIdFor(page, '8.A');
    if (missionId) {
      await page.goto(`/app/campaigns/${missionId}/board`, {
        waitUntil: 'domcontentloaded',
      });
      await settle(page, 2500);
      await shot(page, '10-archiv-nastenka-fragment', { fullPage: true });
    }

    // Bleskovka boardy — young / middle / senior (session zůstává RUNNING)
    await startBleskovka(page, 'Vyjmenovaná slova po B a L', '2.B', 'young');
    await page
      .getByTestId('expedition-intro-start')
      .click({ timeout: 3000 })
      .catch(() => {});
    await settle(page, 800);
    await page.getByTestId('live-reveal').click();
    await settle(page, 900);
    await shot(page, '06-bleskovka-young');

    await startBleskovka(page, 'Vyjmenovaná slova po B a L', '5.A', 'middle');
    await page.getByTestId('live-reveal').click();
    await settle(page, 900);
    await shot(page, '07-bleskovka-middle');

    await startBleskovka(page, 'Literární moderna', 'G2', 'senior');
    await page.getByTestId('live-reveal').click();
    await settle(page, 900);
    await shot(page, '08-bleskovka-senior');

    await context.close();
  }

});

test('portfolio — ředitelka', async ({ browser }) => {
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await login(page, ACCOUNTS.director);
    await settle(page, 2500);
    await shot(page, '11-director-analytika');
    await context.close();
  }
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
 * BONUS: device frame (browser chrome mockup) pro 5 nejlepších záběrů.
 * Rámeček je čisté HTML/CSS — žádná závislost, žádná cizí grafika.
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
  body { margin: 0; padding: 64px; background: linear-gradient(135deg, #eef4e9 0%, #f7f4ec 60%, #eef0f4 100%);
         display: grid; place-items: center; min-height: 100vh; box-sizing: border-box; }
  .frame { width: 1560px; border-radius: 14px; overflow: hidden;
           box-shadow: 0 30px 80px rgba(15, 23, 42, .22), 0 4px 16px rgba(15, 23, 42, .10); background: #fff; }
  .bar { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px;
         background: #f1f3f5; border-bottom: 1px solid #e4e7ea; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .addr { flex: 1; margin: 0 40px; height: 26px; border-radius: 13px; background: #fff;
          border: 1px solid #e4e7ea; color: #6b7280; font: 500 12px/26px -apple-system, sans-serif;
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
