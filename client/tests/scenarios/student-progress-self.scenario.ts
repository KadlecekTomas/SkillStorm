import { test, expect } from './fixtures';

type ProgressContextPayload = {
  classes: Array<{ id: string; label: string; students: Array<{ id: string; name: string }> }>;
  subjects: Array<{ id: string; name: string }>;
};

type StudentProgressPayload = {
  student: { id: string; name: string; classLabel: string };
  summary: { averageGrade: number | null };
  timeline: Array<{ kind: string; title: string; detail: string | null }>;
  interventions?: unknown[];
};

const unwrap = <T>(body: { data?: T } | T): T =>
  typeof body === 'object' && body !== null && 'data' in body
    ? (body as { data: T }).data
    : (body as T);

test.describe('student progress — self-scoped history', () => {
  test('teacher write becomes visible to the same student without any client-supplied student id', async ({
    asRole,
    manifest,
  }) => {
    const { page } = await asRole('student8a');
    const forbidden: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 403) forbidden.push(response.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const beforeResponse = await page.request.get('/api/progress/me');
    expect(beforeResponse.ok(), 'student self progress route resolves identity from session').toBeTruthy();
    const before = unwrap<StudentProgressPayload>(await beforeResponse.json());
    expect(before.student.id).toBeTruthy();
    expect(before.student.name).toBeTruthy();
    expect(before.student.classLabel).toBeTruthy();
    expect(before.interventions, 'student projection must never expose interventions').toBeUndefined();

    const { page: teacherPage } = await asRole('teacher');
    const contextResponse = await teacherPage.request.get('/api/progress/context');
    expect(contextResponse.ok(), 'teacher progress context').toBeTruthy();
    const context = unwrap<ProgressContextPayload>(await contextResponse.json());
    const scopedStudent = context.classes
      .flatMap((classroom) => classroom.students)
      .find((student) => student.id === before.student.id);
    expect(scopedStudent, 'student8a must be inside teacher relational scope').toBeTruthy();
    const subject = context.subjects.find((item) => item.id === manifest.teacherSubjectId);
    expect(subject, 'teacher must have an explicit progress subject').toBeTruthy();

    const comment = `Žákovský self progress ${Date.now()}`;
    const writeResponse = await teacherPage.request.post('/api/progress/entries', {
      data: {
        studentId: before.student.id,
        subjectId: subject!.id,
        gradeValue: 2,
        comment,
        clientMutationId: `student-self-${Date.now()}`,
      },
    });
    expect(writeResponse.ok(), 'teacher creates progress for the same student').toBeTruthy();

    const selfResponse = await page.request.get('/api/progress/me');
    expect(selfResponse.ok(), 'student reads own progress after teacher write').toBeTruthy();
    const self = unwrap<StudentProgressPayload>(await selfResponse.json());
    expect(self.student.id).toBe(before.student.id);
    expect(self.student.name).toBe(before.student.name);
    expect(self.student.classLabel).toBe(before.student.classLabel);
    expect(self.summary.averageGrade).not.toBeNull();
    expect(self.timeline.some((item) => item.detail?.includes(comment))).toBeTruthy();
    expect(self.interventions, 'student projection must never expose interventions').toBeUndefined();

    const staffRouteAttempt = await page.request.get(`/api/progress/students/${before.student.id}`);
    expect(
      staffRouteAttempt.status(),
      'student must not gain staff endpoint even for own id',
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
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);

    expect(
      forbidden.filter((url) => !url.includes(`/api/progress/students/${before.student.id}`)),
      'legitimate student dashboard must not produce unexpected 403s',
    ).toEqual([]);
    expect(pageErrors, 'student progress dashboard must not throw browser errors').toEqual([]);
  });
});
