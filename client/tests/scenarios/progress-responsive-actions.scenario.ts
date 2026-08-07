import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

type ProgressContextPayload = {
  classes: Array<{
    id: string;
    label: string;
    students: Array<{ id: string; name: string }>;
  }>;
  subjects: Array<{ id: string; name: string }>;
};

const unwrap = <T>(body: { data?: T } | T): T =>
  typeof body === 'object' && body !== null && 'data' in body
    ? (body as { data: T }).data
    : (body as T);

async function chooseSelectOption(
  page: import('@playwright/test').Page,
  label: string,
  option: string,
): Promise<void> {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function expectNoPageOverflow(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

async function expectVisibleButtonsTouchSafe(
  page: import('@playwright/test').Page,
): Promise<void> {
  const buttons = page.getByRole('button');
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible())) continue;

    const box = await button.boundingBox();
    expect(
      box?.height ?? 0,
      `visible button ${index} should have at least a 44px touch height`,
    ).toBeGreaterThanOrEqual(44);
  }
}

function collectRuntimeFailures(page: import('@playwright/test').Page) {
  const forbidden: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('response', (response) => {
    if (response.status() === 403) forbidden.push(response.url());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  return { forbidden, pageErrors, consoleErrors };
}

test.describe('school progress — responsive runtime release gate', () => {
  test('teacher completes the primary assessment workflow on phone, tablet, landscape tablet and desktop', async ({
    asRole,
  }) => {
    const { page } = await asRole('teacher');
    const failures = collectRuntimeFailures(page);

    const contextResponse = await page.request.get('/api/progress/context');
    expect(contextResponse.ok(), 'teacher progress context').toBeTruthy();
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());
    const classWithStudent = context.classes.find((item) => item.students.length > 0);
    const subject = context.subjects[0];

    expect(classWithStudent, 'teacher must have a relationally scoped class with a student').toBeTruthy();
    expect(subject, 'teacher must have at least one subject in progress context').toBeTruthy();

    const viewports = [
      { width: 360, height: 800, label: 'phone' },
      { width: 768, height: 1024, label: 'tablet portrait' },
      { width: 1024, height: 768, label: 'tablet landscape' },
      { width: 1440, height: 900, label: 'desktop' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/app/progress', { waitUntil: 'commit' });
      await expect(page.getByRole('heading', { name: 'Zapsat pokrok žáka' })).toBeVisible();

      await chooseSelectOption(page, 'Vyberte třídu', classWithStudent!.label);
      await chooseSelectOption(
        page,
        'Vyberte žáka',
        classWithStudent!.students[0]!.name,
      );
      await chooseSelectOption(page, 'Vyberte předmět', subject!.name);

      const comment = `Responsive release gate — ${viewport.label} — ${Date.now()}`;
      await page
        .getByPlaceholder(/Výborně pracuje samostatně/i)
        .fill(comment);

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/progress/entries'),
      );
      const saveButton = page.getByRole('button', { name: 'Uložit hodnocení' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(
        saveResponse.ok(),
        `${viewport.label} assessment save must reach backend successfully`,
      ).toBeTruthy();
      await expect(
        page.getByText(`Hodnocení pro ${classWithStudent!.students[0]!.name} je uložené.`),
      ).toBeVisible();

      await expectNoPageOverflow(page);
      await expectVisibleButtonsTouchSafe(page);
    }

    expect(failures.forbidden, 'legitimate teacher responsive flow must not produce 403').toEqual([]);
    expect(failures.pageErrors, 'teacher responsive flow must not throw page errors').toEqual([]);
    expect(failures.consoleErrors, 'teacher responsive flow must not log console errors').toEqual([]);
  });

  test('parent school overview stays usable on phone and tablet and its visible controls remain touch-safe', async ({
    asRole,
  }) => {
    const { page } = await asRole('parent');
    const failures = collectRuntimeFailures(page);

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/app/family', { waitUntil: 'commit' });
      await expect(page.getByText('Přehled ze školy')).toBeVisible();
      await expectNoPageOverflow(page);
      await expectVisibleButtonsTouchSafe(page);

      const detailToggle = page.getByRole('button', {
        name: 'Zobrazit více podrobností',
      });
      if ((await detailToggle.count()) > 0 && (await detailToggle.isVisible())) {
        await detailToggle.click();
        await expect(
          page.getByRole('button', { name: 'Skrýt podrobnosti' }),
        ).toBeVisible();
      }
    }

    expect(failures.forbidden, 'legitimate parent overview must not produce 403').toEqual([]);
    expect(failures.pageErrors, 'parent overview must not throw page errors').toEqual([]);
    expect(failures.consoleErrors, 'parent overview must not log console errors').toEqual([]);
  });

  test('leadership can switch views, refresh data and download a real PDF on a phone viewport', async ({
    asRole,
  }) => {
    const { page } = await asRole('director');
    const failures = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/app/progress', { waitUntil: 'commit' });

    await expect(page.getByRole('heading', { name: 'Pokrok školy' })).toBeVisible();
    await expectNoPageOverflow(page);

    await page.getByRole('button', { name: 'Zapsat hodnocení' }).click();
    await expect(page.getByRole('heading', { name: 'Zapsat pokrok žáka' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uložit hodnocení' })).toBeVisible();

    await page.getByRole('button', { name: 'Přehled' }).click();
    await expect(page.getByRole('heading', { name: 'Pokrok školy' })).toBeVisible();
    await expect(page.getByText('Srovnání tříd').first()).toBeVisible();

    const refreshPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/progress/dashboard'),
    );
    await page.getByRole('button', { name: 'Obnovit', exact: true }).click();
    const refreshResponse = await refreshPromise;
    expect(refreshResponse.ok(), 'leadership dashboard refresh reaches backend').toBeTruthy();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Stáhnout PDF' }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path, 'mobile leadership PDF download must persist a file').toBeTruthy();
    const bytes = await readFile(path!);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(3_000);

    await expectNoPageOverflow(page);
    await expectVisibleButtonsTouchSafe(page);
    expect(failures.forbidden, 'legitimate leadership responsive flow must not produce 403').toEqual([]);
    expect(failures.pageErrors, 'leadership responsive flow must not throw page errors').toEqual([]);
    expect(failures.consoleErrors, 'leadership responsive flow must not log console errors').toEqual([]);
  });
});
