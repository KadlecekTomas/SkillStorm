import { test, expect } from './fixtures';

type ProgressContextPayload = {
  classes: Array<{
    id: string;
    label: string;
    students: Array<{ id: string; name: string }>;
  }>;
  subjects: Array<{ id: string; name: string }>;
};

type StudentDetailPayload = {
  timeline: Array<{
    kind: string;
    title: string;
    detail: string | null;
  }>;
  interventions?: Array<{
    title: string;
    note: string | null;
    status: string;
  }>;
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

test.describe('school progress — every visible teacher mode is functional', () => {
  test('attendance and student support perform real writes and read back on a phone viewport', async ({
    asRole,
  }) => {
    const { page } = await asRole('teacher');
    await page.setViewportSize({ width: 360, height: 800 });

    const forbidden: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(response.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const contextResponse = await page.request.get('/api/progress/context');
    expect(contextResponse.ok(), 'teacher progress context').toBeTruthy();
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());
    const classWithStudent = context.classes.find((item) => item.students.length > 0);
    const subject = context.subjects[0];

    expect(classWithStudent, 'teacher has an authorized student').toBeTruthy();
    expect(subject, 'teacher has a subject').toBeTruthy();
    const student = classWithStudent!.students[0]!;

    await page.goto('/app/progress', { waitUntil: 'commit' });
    await chooseSelectOption(page, 'Vyberte třídu', classWithStudent!.label);
    await chooseSelectOption(page, 'Vyberte žáka', student.name);
    await chooseSelectOption(page, 'Vyberte předmět', subject!.name);

    await page.getByRole('tab', { name: 'Docházka' }).click();
    await page.getByRole('button', { name: /Přišel pozdě/i }).click();
    await page.getByLabel('Kolik minut?').fill('7');
    const attendanceNote = `Responsive attendance gate ${Date.now()}`;
    await page.getByLabel('Poznámka (nepovinná)').fill(attendanceNote);

    const attendanceWrite = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/progress/attendance'),
    );
    await page.getByRole('button', { name: 'Uložit docházku' }).click();
    const attendanceResponse = await attendanceWrite;
    expect(attendanceResponse.ok(), 'attendance write reaches backend').toBeTruthy();
    await expect(
      page.getByText(`Docházka pro ${student.name} je uložená.`),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Podpora žáka' }).click();
    const supportTitle = `Release gate podpora ${Date.now()}`;
    const supportNote = 'Ověření viditelného učitelského workflow na mobilu.';
    await page
      .getByPlaceholder(/Individuálně procvičit vyjmenovaná slova/i)
      .fill(supportTitle);
    await page
      .getByPlaceholder(/Co jsme domluvili, kdo pomůže/i)
      .fill(supportNote);

    const supportWrite = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/progress/interventions'),
    );
    await page.getByRole('button', { name: 'Uložit podporu žáka' }).click();
    const supportResponse = await supportWrite;
    expect(supportResponse.ok(), 'student support write reaches backend').toBeTruthy();
    await expect(
      page.getByText(`Podpůrné opatření pro ${student.name} je uložené.`),
    ).toBeVisible();

    const detailResponse = await page.request.get(
      `/api/progress/students/${student.id}`,
    );
    expect(detailResponse.ok(), 'teacher can read back the updated student detail').toBeTruthy();
    const detail = unwrap<StudentDetailPayload>(await detailResponse.json());

    expect(
      detail.timeline.some(
        (item) => item.kind === 'ATTENDANCE' && item.detail?.includes('7'),
      ),
      'saved late attendance appears in the student timeline',
    ).toBeTruthy();
    expect(
      (detail.interventions ?? []).some(
        (item) => item.title === supportTitle && item.note === supportNote,
      ),
      'saved student support appears in the teacher-visible intervention list',
    ).toBeTruthy();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);
    expect(forbidden, 'visible teacher modes must not produce legitimate 403s').toEqual([]);
    expect(pageErrors, 'visible teacher modes must not throw browser errors').toEqual([]);
  });
});
