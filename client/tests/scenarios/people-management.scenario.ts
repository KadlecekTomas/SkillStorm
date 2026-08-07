import { expect, request as playwrightRequest, test } from '@playwright/test';
import { loadManifest, storageStateFor } from './manifest';

const SIZES = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

type SchoolPerson = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: 'OWNER' | 'DIRECTOR' | 'TEACHER';
};

function unwrap<T>(value: T | { data?: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return ((value as { data?: T }).data ?? value) as T;
  }
  return value as T;
}

test.describe('school people management', () => {
  test.use({ storageState: storageStateFor('director') });

  for (const size of SIZES) {
    test(`director sees a clean people workspace on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto('/app/people');
      await expect(page.getByRole('heading', { name: 'Lidé ve škole' })).toBeVisible();
      await expect(page.getByText('Žáci, učitelé a vedení na jednom místě.')).toBeVisible();
      const addStudent = page.getByRole('link', { name: /Přidat žáka/ });
      const addTeacher = page.getByRole('button', { name: /Pozvat učitele/ });
      const addLeadership = page.getByRole('button', { name: /Přidat vedení/ });
      await expect(addStudent).toBeVisible();
      await expect(addTeacher).toBeVisible();
      await expect(addLeadership).toBeVisible();

      for (const locator of [addStudent, addTeacher, addLeadership]) {
        const box = await locator.boundingBox();
        expect(box, 'action has a measurable touch target').not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);

      await page.screenshot({
        path: `test-results/people-${size.name}.png`,
        fullPage: true,
      });
    });
  }

  test('director can create teacher and leadership invites', async ({ page }) => {
    await page.goto('/app/people');

    const teacherInviteResponse = page.waitForResponse(
      (response) => response.url().includes('/invites') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Pozvat učitele/ }).click();
    expect((await teacherInviteResponse).status()).toBeLessThan(400);
    await expect(page.getByLabel('Kód pozvánky')).not.toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Kód pozvánky')).toBeHidden();

    const leadershipInviteResponse = page.waitForResponse(
      (response) => response.url().includes('/invites') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Přidat vedení/ }).click();
    expect((await leadershipInviteResponse).status()).toBeLessThan(400);
    await expect(page.getByLabel('Kód pozvánky')).not.toHaveValue('');
  });

  test('staff name and email edit persist and can be restored', async ({ page }) => {
    await page.goto('/app/people');
    const listResponse = await page.request.get('/api/school-people');
    expect(listResponse.ok()).toBeTruthy();
    const people = unwrap<SchoolPerson[]>(await listResponse.json());
    const teacher = people.find((person) => person.role === 'TEACHER');
    expect(teacher, 'seed contains an editable teacher').toBeTruthy();

    const originalName = teacher!.name ?? 'Učitel Scénář';
    const originalEmail = teacher!.email ?? 'teacher@scenar.test';
    const marker = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const nextName = `${originalName} QA`;
    const nextEmail = `teacher-people-${marker}@scenar.test`;

    try {
      const row = page.getByText(originalEmail).locator('xpath=ancestor::div[contains(@class,"p-5")][1]');
      await row.getByRole('button', { name: 'Upravit' }).click();
      await page.getByLabel('Jméno zaměstnance').fill(nextName);
      await page.getByLabel('E-mail zaměstnance').fill(nextEmail);
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/school-people/${teacher!.membershipId}`) &&
          response.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Uložit', exact: true }).click();
      expect((await patchResponse).status()).toBeLessThan(400);

      const readBack = await page.request.get('/api/school-people');
      const updated = unwrap<SchoolPerson[]>(await readBack.json()).find(
        (person) => person.membershipId === teacher!.membershipId,
      );
      expect(updated?.name).toBe(nextName);
      expect(updated?.email).toBe(nextEmail);
    } finally {
      await page.request.patch(`/api/school-people/${teacher!.membershipId}`, {
        data: { name: originalName, email: originalEmail },
      });
    }
  });

  test('student profile edit persists and can be restored', async ({ page }) => {
    const manifest = loadManifest();
    const studentId = manifest.students8A[0];
    expect(studentId).toBeTruthy();

    await page.goto(`/app/students/${studentId}`);
    await expect(page.getByTestId('student-admin-editor')).toBeVisible();
    await page.getByRole('button', { name: 'Upravit žáka' }).click();

    const nameInput = page.getByLabel('Jméno a příjmení žáka');
    const emailInput = page.getByLabel('E-mail žáka');
    const originalName = await nameInput.inputValue();
    const originalEmail = await emailInput.inputValue();
    const marker = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const nextName = `${originalName} QA`;
    const nextEmail = `student-people-${marker}@scenar.test`;

    try {
      await nameInput.fill(nextName);
      await emailInput.fill(nextEmail);
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/students/${studentId}/profile`) &&
          response.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Uložit změny' }).click();
      expect((await patchResponse).status()).toBeLessThan(400);

      const readBackResponse = await page.request.get(`/api/students/${studentId}`);
      expect(readBackResponse.ok()).toBeTruthy();
      const readBack = unwrap<any>(await readBackResponse.json());
      expect(readBack.membership.user.name).toBe(nextName);
      expect(readBack.membership.user.email).toBe(nextEmail);
    } finally {
      await page.request.patch(`/api/students/${studentId}/profile`, {
        data: { name: originalName, email: originalEmail },
      });
    }
  });

  test('teacher cannot issue a leadership invite through the API', async () => {
    const teacherRequest = await playwrightRequest.newContext({
      baseURL: process.env.BASE_URL || 'http://127.0.0.1:3001',
      storageState: storageStateFor('teacher'),
    });
    try {
      const response = await teacherRequest.post('/api/invites', {
        data: { type: 'ORG_ONLY', role: 'DIRECTOR' },
      });
      expect(response.status()).toBe(403);
    } finally {
      await teacherRequest.dispose();
    }
  });
});
