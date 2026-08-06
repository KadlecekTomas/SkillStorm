import { test, expect } from './fixtures';

/**
 * School-readiness release gate.
 *
 * These scenarios encode the UX/RBAC contract that matters in a real school:
 * - if a teacher can see a student in their class, the student profile opens;
 * - student navigation never advertises teacher-only modules;
 * - direct navigation to a teacher route is blocked before teacher APIs fire;
 * - teacher diagnostics load without legitimate 403s;
 * - every visible primary action exercised here actually performs its action.
 */
test.describe('school readiness — RBAC and visible-action contract', () => {
  test('teacher can open a student exposed by their own class risk roster', async ({ asRole, manifest }) => {
    const { page } = await asRole('teacher');
    const forbidden: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(response.url());
    });

    const riskResponse = await page.request.get(
      `/api/classrooms/${manifest.class8AId}/risk-overview`,
    );
    expect(riskResponse.ok(), 'teacher risk overview for taught class').toBeTruthy();
    const riskBody = await riskResponse.json();
    const roster = (riskBody.data ?? riskBody)?.students ?? [];
    expect(roster.length, 'seeded taught class exposes students').toBeGreaterThan(0);

    const student = roster[0] as { studentId: string; displayName: string };
    await page.goto(`/app/students/${student.studentId}`, { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: student.displayName })).toBeVisible();
    await expect(page.getByText(/Přehled výkonu/i)).toBeVisible();
    expect(forbidden, `legitimate teacher journey returned 403: ${forbidden.join(', ')}`).toEqual([]);
  });

  test('student navigation exposes only student workflows and blocks teacher results before API calls', async ({ asRole }) => {
    const { page } = await asRole('student8a');
    const teacherAnalyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/analytics/teacher/')) {
        teacherAnalyticsRequests.push(request.url());
      }
    });

    await page.goto('/app', { waitUntil: 'commit' });
    const nav = page.getByRole('navigation', { name: 'Hlavní navigace' }).first();
    await expect(nav.locator('a[href="/app/assignments"]')).toBeVisible();
    await expect(nav.locator('a[href="/app/student/analytics"]')).toBeVisible();
    await expect(nav.locator('a[href="/app/classrooms"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/app/results"]')).toHaveCount(0);

    await page.goto('/app/results', { waitUntil: 'commit' });
    await expect(page.getByText('Přístup není povolen')).toBeVisible();
    expect(
      teacherAnalyticsRequests,
      'guard must block student before teacher analytics requests are issued',
    ).toEqual([]);
  });

  test('teacher diagnostics load without 403 and Export PDF invokes the print-to-PDF action', async ({ asRole }) => {
    const { page } = await asRole('teacher');
    const forbidden: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(response.url());
    });

    await page.goto('/app/results', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Diagnostika výsledků' })).toBeVisible();
    await expect(page.getByText('Přehled žáků')).toBeVisible();

    await page.evaluate(() => {
      (window as Window & { __skillstormPrintCalled?: boolean }).__skillstormPrintCalled = false;
      window.print = () => {
        (window as Window & { __skillstormPrintCalled?: boolean }).__skillstormPrintCalled = true;
      };
    });
    const exportButton = page.getByRole('button', { name: 'Export PDF' });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __skillstormPrintCalled?: boolean })
              .__skillstormPrintCalled ?? false,
        ),
      )
      .toBe(true);

    expect(forbidden, `teacher diagnostics returned 403: ${forbidden.join(', ')}`).toEqual([]);
  });

  test('teacher test list never offers edit/archive actions for a non-author test', async ({ asRole, manifest }) => {
    const { page: directorPage } = await asRole('director');

    const subjectsResponse = await directorPage.request.get('/api/org-subjects');
    expect(subjectsResponse.ok(), 'director can load organization subjects').toBeTruthy();
    const subjectsBody = await subjectsResponse.json();
    const subjects = (subjectsBody.data ?? subjectsBody)?.data ?? subjectsBody.data ?? subjectsBody;
    const firstOrgSubject = Array.isArray(subjects) ? subjects[0] : null;
    const subjectId = firstOrgSubject?.subject?.id ?? firstOrgSubject?.subjectId ?? null;

    if (!subjectId) {
      test.skip(true, 'scenario seed did not expose an organization subject');
      return;
    }

    const createResponse = await directorPage.request.post('/api/tests', {
      data: {
        title: 'Ředitelský koncept — RBAC gate',
        description: 'Non-author CTA regression fixture',
        subjectId,
        allowedGrades: ['GRADE_8'],
        status: 'DRAFT',
      },
    });
    expect(createResponse.ok(), 'director-owned test fixture').toBeTruthy();

    const { page: teacherPage } = await asRole('teacher');
    await teacherPage.goto('/app/tests', { waitUntil: 'commit' });

    // Teacher drafts are private in the UI: a foreign draft must not be
    // actionable, while the page itself remains healthy.
    await expect(teacherPage.getByText('Ředitelský koncept — RBAC gate')).toHaveCount(0);
    await expect(teacherPage.getByRole('heading', { name: /Testy školy/i })).toBeVisible();
    expect(manifest.orgId).toBeTruthy();
  });

  test('profile settings perform a real self-update request instead of a local fake submit', async ({ asRole }) => {
    const { page } = await asRole('teacher');
    const meResponse = await page.request.get('/api/auth/me');
    expect(meResponse.ok(), 'teacher auth profile').toBeTruthy();
    const meBody = await meResponse.json();
    const me = meBody.data ?? meBody;
    const user = me.user ?? me;
    expect(user.id).toBeTruthy();
    expect(user.email).toBeTruthy();

    await page.goto('/app/settings', { waitUntil: 'commit' });
    await page.getByPlaceholder('Celé jméno').fill(user.name ?? user.fullName ?? 'Učitel Scénář');
    await page.getByPlaceholder('E-mail').fill(user.email);

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/users/${user.id}`),
    );
    await page.getByRole('button', { name: 'Uložit profil' }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok(), 'profile save must reach backend successfully').toBeTruthy();
    await expect(page.getByText('Profil byl uložen.')).toBeVisible();
  });
});
