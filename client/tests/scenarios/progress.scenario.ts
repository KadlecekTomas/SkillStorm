import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

type ProgressContextPayload = {
  academicYear: { id: string; label: string };
  classes: Array<{
    id: string;
    label: string;
    students: Array<{ id: string; name: string }>;
  }>;
  subjects: Array<{ id: string; name: string }>;
  competencies: Array<{ id: string; name: string; subjectId: string | null }>;
};

type GuardianChildrenPayload = {
  children: Array<{ studentId: string; name: string; classLabel: string | null }>;
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
  const trigger = page.getByLabel(label);
  await trigger.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(trigger).toContainText(option);
}

test.describe('school progress — simplified ZŠ workflow', () => {
  test.describe.configure({ mode: 'serial' });

  let parentChildId = '';
  let parentChildName = '';
  let parentChildClassLabel = '';
  let teacherSubjectId = '';
  let competencyName = '';
  const onlineComment = `Průběžná zpětná vazba ${Date.now()}`;
  const offlineComment = `Offline hodnocení ${Date.now()}`;

  test('teacher gets only relational scope and saves a real mark + competency + comment', async ({
    asRole,
    manifest,
  }) => {
    const { page: parentPage } = await asRole('parent');
    const childrenResponse = await parentPage.request.get('/api/guardian/children');
    expect(childrenResponse.ok(), 'parent children fixture').toBeTruthy();
    const children = unwrap<GuardianChildrenPayload>(await childrenResponse.json());
    expect(children.children.length).toBeGreaterThan(0);
    parentChildId = children.children[0]!.studentId;
    parentChildName = children.children[0]!.name;
    parentChildClassLabel = children.children[0]!.classLabel ?? '';
    expect(parentChildClassLabel, 'guardian child must have an active class').toBeTruthy();

    const { page: teacherPage } = await asRole('teacher');
    const contextResponse = await teacherPage.request.get('/api/progress/context');
    expect(contextResponse.ok(), 'teacher progress context').toBeTruthy();
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());

    const classIds = context.classes.map((item) => item.id);
    expect(classIds).toContain(manifest.class8AId);
    expect(classIds).toContain(manifest.class2AId);
    expect(
      classIds,
      'teacher context must not expose same-org class without a teacher relationship',
    ).not.toContain(manifest.untaughtClassId);

    teacherSubjectId = manifest.teacherSubjectId;
    const subject = context.subjects.find((item) => item.id === teacherSubjectId);
    expect(subject, 'scenario teacher must have an explicit TeacherSubject').toBeTruthy();

    const { page: directorPage } = await asRole('director');
    competencyName = `Samostatné řešení ${Date.now()}`;
    const competencyResponse = await directorPage.request.post('/api/progress/competencies', {
      data: {
        subjectId: teacherSubjectId,
        name: competencyName,
        description: 'Scénářová kompetence pro browser gate.',
        scaleMin: 1,
        scaleMax: 4,
      },
    });
    expect(competencyResponse.ok(), 'director can create a school competency').toBeTruthy();

    await teacherPage.goto('/app/progress', { waitUntil: 'commit' });
    await expect(
      teacherPage.getByRole('heading', { name: 'Zapsat pokrok žáka' }),
    ).toBeVisible();
    await expect(
      teacherPage.getByRole('button', { name: 'Uložit hodnocení' }),
    ).toBeVisible();

    const nav = teacherPage.getByRole('navigation', { name: 'Hlavní navigace' }).first();
    await expect(nav.locator('a[href="/app/progress"]')).toBeVisible();

    await chooseSelectOption(teacherPage, 'Vyberte třídu', parentChildClassLabel);
    await chooseSelectOption(teacherPage, 'Vyberte žáka', parentChildName);
    await chooseSelectOption(teacherPage, 'Vyberte předmět', subject!.name);
    await chooseSelectOption(teacherPage, 'Vyberte kompetenci', competencyName);

    await teacherPage.getByRole('button', { name: '2', exact: true }).click();
    await teacherPage.getByRole('button', { name: '3/4', exact: true }).click();
    await teacherPage
      .getByPlaceholder(/Výborně pracuje samostatně/i)
      .fill(onlineComment);

    await teacherPage.getByRole('button', { name: 'A+ Velké písmo' }).click();
    await expect(
      teacherPage.getByRole('button', { name: 'A+ Velké písmo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await teacherPage.getByRole('button', { name: 'Kontrast' }).click();
    await expect(teacherPage.getByRole('button', { name: 'Kontrast' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const saveResponsePromise = teacherPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/progress/entries'),
    );
    await teacherPage.getByRole('button', { name: 'Uložit hodnocení' }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok(), 'teacher assessment write reaches backend').toBeTruthy();
    await expect(
      teacherPage.getByText(`Hodnocení pro ${parentChildName} je uložené.`),
    ).toBeVisible();

    const detailResponse = await teacherPage.request.get(
      `/api/progress/students/${parentChildId}`,
    );
    expect(detailResponse.ok(), 'teacher can read own student progress').toBeTruthy();
    const detail = unwrap<{
      summary: { averageGrade: number | null };
      competencyMap: Array<{ name: string; level: number }>;
      timeline: Array<{ detail: string | null }>;
    }>(await detailResponse.json());
    expect(detail.summary.averageGrade).toBe(2);
    expect(detail.competencyMap).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: competencyName, level: 3 })]),
    );
    expect(detail.timeline.some((item) => item.detail?.includes(onlineComment))).toBeTruthy();

    const forbidden = await teacherPage.request.post('/api/progress/entries', {
      data: {
        studentId: manifest.unrelatedStudentId,
        subjectId: teacherSubjectId,
        gradeValue: 1,
        clientMutationId: `scope-${Date.now()}`,
      },
    });
    expect(
      forbidden.status(),
      'teacher must not write progress for a same-org student outside relational class scope',
    ).toBe(403);
  });

  test('parent sees one-page school progress but cannot read an unrelated student', async ({
    asRole,
    manifest,
  }) => {
    expect(parentChildId).toBeTruthy();
    const { page } = await asRole('parent');
    await page.goto('/app/family', { waitUntil: 'commit' });

    await expect(page.getByText('Přehled ze školy')).toBeVisible();
    await expect(page.getByText('Průměrná známka')).toBeVisible();
    await expect(page.getByText(competencyName, { exact: true })).toBeVisible();
    await expect(page.getByText(onlineComment)).toBeVisible();
    await expect(page.getByText('Zprávy ze školy')).toBeVisible();

    const unrelated = await page.request.get(
      `/api/progress/guardian/students/${manifest.unrelatedStudentId}`,
    );
    expect(unrelated.status(), 'guardian relation must be child-specific').toBe(403);
  });

  test('leadership gets school dashboard and downloads a real PDF', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('director');
    const dashboardResponse = await page.request.get('/api/progress/dashboard');
    expect(dashboardResponse.ok(), 'director progress dashboard').toBeTruthy();
    const dashboard = unwrap<{
      summary: { studentCount: number; progressEntries: number };
      classes: Array<{ classSectionId: string; classLabel: string }>;
    }>(await dashboardResponse.json());
    expect(dashboard.summary.studentCount).toBeGreaterThan(0);
    expect(dashboard.summary.progressEntries).toBeGreaterThan(0);
    expect(dashboard.classes.map((item) => item.classSectionId)).toContain(manifest.class8AId);
    expect(dashboard.classes.map((item) => item.classSectionId)).toContain(
      manifest.untaughtClassId,
    );
    const untaughtClass = dashboard.classes.find(
      (item) => item.classSectionId === manifest.untaughtClassId,
    );
    expect(untaughtClass, 'untaught class must be present in director dashboard').toBeTruthy();

    await page.goto('/app/progress', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Pokrok školy' })).toBeVisible();
    await expect(page.getByText('Srovnání tříd')).toBeVisible();
    await expect(
      page.getByRole('cell', { name: untaughtClass!.classLabel, exact: true }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Stáhnout PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^SkillStorm-pokrok-skoly-.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    const bytes = await readFile(path!);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(3_000);
  });

  test('teacher can save assessment offline and sync it exactly once after reconnect', async ({
    asRole,
  }) => {
    expect(parentChildId).toBeTruthy();
    expect(parentChildClassLabel).toBeTruthy();
    const { page } = await asRole('teacher');
    const contextResponse = await page.request.get('/api/progress/context');
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());
    const subject = context.subjects.find((item) => item.id === teacherSubjectId);
    expect(subject).toBeTruthy();

    await page.goto('/app/progress', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Zapsat pokrok žáka' })).toBeVisible();
    await chooseSelectOption(page, 'Vyberte třídu', parentChildClassLabel);
    await chooseSelectOption(page, 'Vyberte žáka', parentChildName);
    await chooseSelectOption(page, 'Vyberte předmět', subject!.name);

    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByPlaceholder(/Výborně pracuje samostatně/i).fill(offlineComment);
    await page.getByRole('button', { name: 'Uložit hodnocení' }).click();
    await expect(
      page.getByText(/Uloženo do tohoto zařízení.*automaticky odešle/i),
    ).toBeVisible();
    await expect(page.getByText(/1 čeká na synchronizaci/i)).toBeVisible();

    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.getByText(/1 offline záznamů bylo synchronizováno/i)).toBeVisible({
      timeout: 15_000,
    });

    const detailResponse = await page.request.get(`/api/progress/students/${parentChildId}`);
    expect(detailResponse.ok()).toBeTruthy();
    const detail = unwrap<{ timeline: Array<{ detail: string | null }> }>(
      await detailResponse.json(),
    );
    expect(
      detail.timeline.filter((item) => item.detail?.includes(offlineComment)),
      'idempotent offline mutation must exist exactly once',
    ).toHaveLength(1);
  });

  test('teacher, parent and leadership progress surfaces fit phone, tablet and desktop without page overflow', async ({
    asRole,
  }) => {
    const assertNoPageOverflow = async (page: import('@playwright/test').Page) => {
      await expect.poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      ).toBe(true);
    };

    const { page: teacherPage } = await asRole('teacher');
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await teacherPage.setViewportSize(viewport);
      await teacherPage.goto('/app/progress', { waitUntil: 'commit' });
      await expect(teacherPage.getByRole('heading', { name: 'Zapsat pokrok žáka' })).toBeVisible();
      await expect(teacherPage.getByRole('button', { name: 'Uložit hodnocení' })).toBeVisible();
      await assertNoPageOverflow(teacherPage);
      const box = await teacherPage.getByRole('button', { name: 'Uložit hodnocení' }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const { page: parentPage } = await asRole('parent');
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
    ]) {
      await parentPage.setViewportSize(viewport);
      await parentPage.goto('/app/family', { waitUntil: 'commit' });
      await expect(parentPage.getByText('Přehled ze školy')).toBeVisible();
      await assertNoPageOverflow(parentPage);
    }

    const { page: directorPage } = await asRole('director');
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await directorPage.setViewportSize(viewport);
      await directorPage.goto('/app/progress', { waitUntil: 'commit' });
      await expect(directorPage.getByRole('heading', { name: 'Pokrok školy' })).toBeVisible();
      await expect(directorPage.getByText('Srovnání tříd')).toBeVisible();
      await assertNoPageOverflow(directorPage);
    }
  });

});
