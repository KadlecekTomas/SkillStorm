import { expect, test, type Page, type Response } from '@playwright/test';
import { loadManifest, storageStateFor } from './manifest';

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const PUBLIC_ROUTES = [
  ['landing', '/'],
  ['login', '/login'],
  ['register', '/register'],
  ['forgot-password', '/forgot-password'],
  ['reset-password', '/reset-password'],
  ['public-library', '/public-library'],
  ['eduto', '/eduto'],
  ['handbook', '/handbook'],
] as const;

const ROLE_ROUTES = {
  director: [
    ['overview', '/app'],
    ['progress', '/app/progress'],
    ['classrooms', '/app/classrooms'],
    ['people', '/app/people'],
    ['tests', '/app/tests'],
    ['library', '/app/library'],
    ['results', '/app/results'],
    ['settings', '/app/settings'],
    ['teacher-access', '/app/settings/teachers'],
    ['account-security', '/account/security'],
  ],
  teacher: [
    ['overview', '/app'],
    ['progress', '/app/progress'],
    ['classrooms', '/app/classrooms'],
    ['tests', '/app/tests'],
    ['library', '/app/library'],
    ['results', '/app/results'],
    ['settings', '/app/settings'],
  ],
  student8a: [
    ['overview-self-progress', '/app'],
    ['assignments', '/app/assignments'],
    ['tests', '/app/tests'],
    ['library', '/app/library'],
    ['analytics', '/app/student/analytics'],
    ['settings', '/app/settings'],
  ],
  parent: [
    ['family', '/app/family'],
    ['settings', '/app/settings'],
  ],
  superadmin: [
    ['platform-overview', '/app/platform'],
    ['platform-organizations', '/app/platform/organizations'],
    ['platform-users', '/app/platform/users'],
    ['platform-catalog', '/app/platform/catalog'],
    ['platform-audit', '/app/platform/audit'],
    ['platform-support', '/app/platform/support'],
  ],
} as const;

type RoleKey = keyof typeof ROLE_ROUTES;
type SchoolPerson = {
  membershipId: string;
  email: string | null;
  role: 'OWNER' | 'DIRECTOR' | 'TEACHER';
};
type StudentListItem = {
  id: string;
  membership?: { user?: { email?: string | null } | null } | null;
};
type StudentListPayload = { data?: StudentListItem[] };

function unwrap<T>(value: T | { data?: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return ((value as { data?: T }).data ?? value) as T;
  }
  return value as T;
}

function filePath(viewport: string, audience: string, key: string): string {
  return `test-results/visual-matrix/${viewport}/${audience}-${key}.png`;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 2_500 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function captureRoute(
  page: Page,
  viewportName: string,
  audience: string,
  key: string,
  route: string,
): Promise<void> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];

  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onResponse = (response: Response) => {
    const status = response.status();
    const request = response.request();
    if (
      status >= 400 &&
      (response.url().includes('/api/') || request.resourceType() === 'document')
    ) {
      badResponses.push(`${status} ${request.method()} ${response.url()}`);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  try {
    const navigation = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(navigation, `${audience}/${key} returns a document response`).not.toBeNull();
    expect(navigation!.status(), `${audience}/${key} document status`).toBeLessThan(400);
    await settle(page);

    await page.addStyleTag({
      content:
        '*,*::before,*::after{animation-duration:0.001s!important;animation-delay:0s!important;transition-duration:0.001s!important;scroll-behavior:auto!important}',
    }).catch(() => undefined);

    const body = page.locator('body');
    await expect(body).toBeVisible();
    const bodyText = (await body.innerText()).trim();
    expect(bodyText.length, `${audience}/${key} renders meaningful content`).toBeGreaterThan(20);
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');

    const rootOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(rootOverflow, `${audience}/${key} has no page-level horizontal overflow`).toBe(false);
    expect(pageErrors, `${audience}/${key} page errors`).toEqual([]);
    expect(consoleErrors, `${audience}/${key} console errors`).toEqual([]);
    expect(badResponses, `${audience}/${key} API/document 4xx/5xx responses`).toEqual([]);

    await page.screenshot({
      path: filePath(viewportName, audience, key),
      fullPage: true,
    });
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }
}

async function resolveSeedStudentId(page: Page): Promise<string> {
  const manifest = loadManifest();
  const studentEmail = manifest.accounts.student8a;
  const studentSearch = await page.request.get(
    `/api/students?search=${encodeURIComponent(studentEmail)}&limit=10`,
  );
  expect(studentSearch.ok()).toBeTruthy();
  const studentList = unwrap<StudentListPayload | StudentListItem[]>(await studentSearch.json());
  const rows = Array.isArray(studentList)
    ? studentList
    : Array.isArray(studentList.data)
      ? studentList.data
      : [];
  const student =
    rows.find((row) => row.membership?.user?.email === studentEmail) ?? rows[0];
  expect(student?.id, 'seed student resolves to Student.id').toBeTruthy();
  return student!.id;
}

async function captureChangedDirectorStates(
  page: Page,
  viewportName: string,
): Promise<void> {
  await page.goto('/app/people');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Lidé ve škole' })).toBeVisible();

  const teacherInvite = page.waitForResponse(
    (response) => response.url().includes('/invites') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Pozvat učitele/ }).click();
  expect((await teacherInvite).status()).toBeLessThan(400);
  await expect(page.getByLabel('Kód pozvánky')).not.toHaveValue('');
  await page.screenshot({
    path: filePath(viewportName, 'director', 'people-teacher-invite-modal'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  const leadershipInvite = page.waitForResponse(
    (response) => response.url().includes('/invites') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Přidat vedení/ }).click();
  expect((await leadershipInvite).status()).toBeLessThan(400);
  await expect(page.getByLabel('Kód pozvánky')).not.toHaveValue('');
  await page.screenshot({
    path: filePath(viewportName, 'director', 'people-leadership-invite-modal'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  const listResponse = await page.request.get('/api/school-people');
  expect(listResponse.ok()).toBeTruthy();
  const people = unwrap<SchoolPerson[]>(await listResponse.json());
  const teacher = people.find((person) => person.role === 'TEACHER');
  expect(teacher?.email).toBeTruthy();
  const row = page
    .getByText(teacher!.email!)
    .locator('xpath=ancestor::div[contains(@class,"p-5")][1]');
  await row.getByRole('button', { name: 'Upravit' }).click();
  await expect(page.getByLabel('Jméno zaměstnance')).toBeVisible();
  await page.screenshot({
    path: filePath(viewportName, 'director', 'people-staff-edit-modal'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  const studentId = await resolveSeedStudentId(page);
  await page.goto(`/app/students/${studentId}`);
  await settle(page);
  await expect(page.getByTestId('student-admin-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Upravit žáka' }).click();
  await expect(page.getByLabel('Jméno a příjmení žáka')).toBeVisible();
  await page.screenshot({
    path: filePath(viewportName, 'director', 'student-admin-editor'),
    fullPage: true,
  });
}

test.describe('visual release matrix — whole SkillStorm', () => {
  test.describe.configure({ mode: 'serial' });

  for (const viewport of VIEWPORTS) {
    test(`anonymous surfaces — ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      try {
        for (const [key, route] of PUBLIC_ROUTES) {
          await captureRoute(page, viewport.name, 'public', key, route);
        }
      } finally {
        await context.close();
      }
    });

    for (const role of Object.keys(ROLE_ROUTES) as RoleKey[]) {
      test(`${role} workspace — ${viewport.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          storageState: storageStateFor(role),
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        try {
          for (const [key, route] of ROLE_ROUTES[role]) {
            await captureRoute(page, viewport.name, role, key, route);
          }
          if (role === 'director') {
            await captureChangedDirectorStates(page, viewport.name);
          }
        } finally {
          await context.close();
        }
      });
    }
  }
});
