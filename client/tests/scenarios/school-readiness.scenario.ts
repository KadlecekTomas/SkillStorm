import { test, expect } from './fixtures';

/**
 * School-readiness release gate.
 *
 * These scenarios encode the UX/RBAC contract that matters in a real school:
 * - if a teacher can see a student in their class, the student profile opens;
 * - student and parent navigation never advertises teacher-only modules;
 * - direct navigation to a teacher route is blocked before teacher APIs fire;
 * - teacher diagnostics load without legitimate 403s;
 * - a teacher cannot assign a test to a same-org class they do not teach;
 * - every visible primary action exercised here actually performs its action;
 * - every visible main-navigation target must render successfully for that role.
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

  test('parent sees only family workflows and a verified child', async ({ asRole }) => {
    const { page } = await asRole('parent');
    const teacherAnalyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/analytics/teacher/')) {
        teacherAnalyticsRequests.push(request.url());
      }
    });

    await page.goto('/app/family', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Moje děti' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Hlavní navigace' }).first();
    await expect(nav.locator('a[href="/app/family"]')).toBeVisible();
    await expect(nav.locator('a[href="/app/settings"]')).toBeVisible();
    await expect(nav.locator('a[href="/app/classrooms"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/app/tests"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/app/results"]')).toHaveCount(0);
    await expect(page.getByText(/Žák · 8\.A/i)).toBeVisible();

    await page.goto('/app/results', { waitUntil: 'commit' });
    await expect(page.getByText('Přístup není povolen')).toBeVisible();
    expect(teacherAnalyticsRequests).toEqual([]);
  });

  for (const role of ['director', 'teacher', 'student8a', 'parent'] as const) {
    test(`${role} can open every visible main-navigation target without 403 or error boundary`, async ({ asRole }) => {
      const { page } = await asRole(role);
      await page.goto(role === 'parent' ? '/app/family' : '/app', { waitUntil: 'commit' });
      const nav = page.getByRole('navigation', { name: 'Hlavní navigace' }).first();
      await expect(nav).toBeVisible();
      const hrefs = Array.from(
        new Set(
          await nav.locator('a[href]').evaluateAll((links) =>
            links
              .map((link) => link.getAttribute('href'))
              .filter((href): href is string => Boolean(href && href.startsWith('/app'))),
          ),
        ),
      );
      expect(hrefs.length, `${role} should have visible navigation targets`).toBeGreaterThan(0);

      for (const href of hrefs) {
        const forbidden: string[] = [];
        const listener = (response: { status(): number; url(): string }) => {
          if (response.status() === 403) forbidden.push(response.url());
        };
        page.on('response', listener);
        await page.goto(href, { waitUntil: 'commit' });
        await expect(page.locator('body')).toBeVisible();
        await expect(page.getByText('Přístup není povolen')).toHaveCount(0);
        await expect(page.getByText('Access denied')).toHaveCount(0);
        await expect(page.getByText('Něco se pokazilo')).toHaveCount(0);
        expect(
          forbidden,
          `${role} visible navigation ${href} produced 403: ${forbidden.join(', ')}`,
        ).toEqual([]);
        page.off('response', listener);
      }
    });
  }

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

  test('teacher cannot assign a test to an unrelated class in the same organization', async ({ asRole, manifest }) => {
    const { page: directorPage } = await asRole('director');
    const createClassResponse = await directorPage.request.post('/api/class-sections', {
      data: {
        grade: 'GRADE_9',
        section: 'SECURITY_GATE',
        label: '9.SECURITY_GATE',
      },
    });
    expect(createClassResponse.ok(), 'director can create untaught class fixture').toBeTruthy();
    const classBody = await createClassResponse.json();
    const untaughtClass = classBody.data ?? classBody;
    expect(untaughtClass.id).toBeTruthy();

    const { page: teacherPage } = await asRole('teacher');
    const assignmentResponse = await teacherPage.request.get(
      `/api/assignments/${manifest.assignment8AId}`,
    );
    expect(assignmentResponse.ok(), 'teacher can read own assignment fixture').toBeTruthy();
    const assignmentBody = await assignmentResponse.json();
    const assignment = assignmentBody.data ?? assignmentBody;
    expect(assignment.testId).toBeTruthy();

    const forbidden = await teacherPage.request.post(
      `/api/tests/${assignment.testId}/assign`,
      { data: { classSectionId: untaughtClass.id } },
    );
    expect(forbidden.status()).toBe(403);
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

  test('library Open action navigates to a real material detail', async ({ asRole, manifest }) => {
    const { page } = await asRole('teacher');
    const title = 'School readiness material';
    const createResponse = await page.request.post('/api/learning-materials', {
      data: {
        title,
        description: 'Material created by the school-readiness browser gate.',
        contentType: 'MATERIAL',
        educationLevel: 'PRIMARY_2',
        schoolGrade: 'GRADE_8',
        scope: 'ORGANIZATION',
        organizationId: manifest.orgId,
        accessLevel: 'FREE',
        isDownloadable: true,
      },
    });
    expect(createResponse.ok(), 'teacher can create material fixture').toBeTruthy();
    const createdBody = await createResponse.json();
    const created = createdBody.data ?? createdBody;
    expect(created.id).toBeTruthy();

    const listResponse = await page.request.get('/api/learning-materials');
    expect(listResponse.ok(), 'fresh material list after create').toBeTruthy();
    const listBody = await listResponse.json();
    const listData = listBody.data ?? listBody;
    const items = listData.items ?? [];
    expect(
      items.some((item: { id?: string }) => item.id === created.id),
      'created material must be visible immediately after mutation',
    ).toBeTruthy();

    await page.goto('/app/library', { waitUntil: 'commit' });
    await expect(page.getByText(title)).toBeVisible();
    await page.locator(`a[href="/app/library/${created.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/app/library/${created.id}$`));
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Material created by the school-readiness browser gate.')).toBeVisible();
  });

  test('legacy assignment id on a result URL resolves to a valid assignment or submission target', async ({ asRole, manifest }) => {
    const { page } = await asRole('student8a');
    const legacyResultUrl = `/app/results/${manifest.assignment8AId}`;
    await page.goto(legacyResultUrl, { waitUntil: 'commit' });
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .not.toContain(legacyResultUrl);

    const finalUrl = new URL(page.url());
    const assignmentPath = `/app/assignments/${manifest.assignment8AId}`;
    const isAssignmentRecovery = finalUrl.pathname.startsWith(assignmentPath);
    const resultMatch = finalUrl.pathname.match(/^\/app\/results\/([^/]+)$/);

    expect(
      isAssignmentRecovery || Boolean(resultMatch),
      `legacy result URL must recover to assignment or a real submission, got ${finalUrl.pathname}`,
    ).toBeTruthy();

    if (resultMatch) {
      const recoveredSubmissionId = resultMatch[1];
      expect(recoveredSubmissionId).not.toBe(manifest.assignment8AId);
      await expect(page.getByRole('heading', { name: 'Výsledek pokusu' })).toBeVisible();
    } else {
      await expect(page).toHaveURL(new RegExp(`/app/assignments/${manifest.assignment8AId}`));
    }

    await expect(page.getByText('Přístup není povolen')).toHaveCount(0);
    await expect(page.getByText('Něco se pokazilo')).toHaveCount(0);
  });
});
