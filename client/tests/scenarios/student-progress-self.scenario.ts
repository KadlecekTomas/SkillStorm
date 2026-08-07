import { test, expect } from './fixtures';

type ProgressContextPayload = {
  classes: Array<{
    id: string;
    label: string;
    students: Array<{ id: string; name: string }>;
  }>;
  subjects: Array<{ id: string; name: string }>;
};

type StudentProgressPayload = {
  student: { id: string; name: string; classLabel: string };
  summary: { averageGrade: number | null };
  timeline: Array<{
    kind: string;
    title: string;
    detail: string | null;
  }>;
  interventions?: unknown[];
};

const unwrap = <T>(body: { data?: T } | T): T =>
  typeof body === 'object' && body !== null && 'data' in body
    ? (body as { data: T }).data
    : (body as T);

test.describe('student progress — self-scoped history', () => {
  test('teacher write becomes visible to the same student without any client-supplied student id', async ({
    asRole,
  }) => {
    const { page: teacherPage } = await asRole('teacher');
    const contextResponse = await teacherPage.request.get('/api/progress/context');
    expect(contextResponse.ok(), 'teacher progress context').toBeTruthy();
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());

    const class8A = context.classes.find((item) => item.label === '8.A');
    const student = class8A?.students.find((item) => item.name === 'Žák 8.A #1');
    const subject = context.subjects[0];
    expect(student, 'student8a fixture must resolve through teacher relational scope').toBeTruthy();
    expect(subject, 'teacher must have a progress subject').toBeTruthy();

    const comment = `Žákovský self progress ${Date.now()}`;
    const writeResponse = await teacherPage.request.post('/api/progress/entries', {
      data: {
        studentId: student!.id,
        subjectId: subject!.id,
        gradeValue: 2,
        comment,
        clientMutationId: `student-self-${Date.now()}`,
      },
    });
    expect(writeResponse.ok(), 'teacher creates progress for student8a').toBeTruthy();

    const { page } = await asRole('student8a');
    const forbidden: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(response.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const selfResponse = await page.request.get('/api/progress/me');
    expect(selfResponse.ok(), 'student self progress route').toBeTruthy();
    const self = unwrap<StudentProgressPayload>(await selfResponse.json());
    expect(self.student.id).toBe(student!.id);
    expect(self.student.name).toBe('Žák 8.A #1');
    expect(self.student.classLabel).toBe('8.A');
    expect(self.summary.averageGrade).toBe(2);
    expect(self.timeline.some((item) => item.detail?.includes(comment))).toBeTruthy();
    expect(self.interventions).toBeUndefined();

    const staffRouteAttempt = await page.request.get(`/api/progress/students/${student!.id}`);
    expect(
      staffRouteAttempt.status(),
      'student must not gain access to staff progress endpoint even for own id',
    ).toBe(403);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/app', { waitUntil: 'commit' });
    await expect(page.getByText('Můj pokrok', { exact: true })).toBeVisible();
    await expect(page.getByTestId('student-school-progress')).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();
    await expect(page.getByText('Průměrná známka')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);

    expect(
      forbidden.filter((url) => !url.includes(`/api/progress/students/${student!.id}`)),
      'legitimate student dashboard flow must not produce unexpected 403s',
    ).toEqual([]);
    expect(pageErrors, 'student progress dashboard must not throw browser errors').toEqual([]);
  });
});
