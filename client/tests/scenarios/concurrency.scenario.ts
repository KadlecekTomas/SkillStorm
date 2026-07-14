import { test, expect } from './fixtures';
import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * BLOK 2 — a whole (capped) class answering at once, in real browsers.
 *
 * 10 students × their own browser context answer the SAME 8.A assignment in
 * parallel and submit together. Criteria: all 10 submissions exist, none
 * lost an answer, no 5xx. Plus: a student who never submits manually is
 * auto-submitted when the (short) time limit expires.
 *
 * 10 contexts is the CI-runner ceiling; the full 30-student write storm is
 * covered by the backend load test (production-hardening branch).
 */

const PARALLEL = 10;

/** A browser context authenticated as `email` via the login API (own IP). */
async function authedContext(
  browser: Browser,
  email: string,
  password: string,
  organizationId: string,
  ipSuffix: number,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'X-Forwarded-For': `10.60.${ipSuffix}.1` },
  });
  const res = await context.request.post('/api/auth/login', {
    data: { email, password, organizationId },
  });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  const page = await context.newPage();
  return { context, page };
}

/** Answer all three questions of "Matematika 8.A" and submit. */
async function answerAndSubmit(page: Page, assignmentId: string): Promise<void> {
  await page.goto(`/app/assignments/${assignmentId}/test`, { waitUntil: 'commit' });
  await expect(page.getByTestId('test-top-status-bar')).toBeVisible({ timeout: 30_000 });

  // Q1 TF: Ano
  await page.getByRole('radio', { name: /Ano/ }).check();
  // Q2 MC: 42
  await page.getByRole('button', { name: 'Otázka 2' }).click();
  await page.getByRole('radio', { name: /^42$/ }).check();
  // Q3 FITB: 9 — wait for its save so submit is not blocked on unsaved
  await page.getByRole('button', { name: 'Otázka 3' }).click();
  const saved = page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 20_000 },
  );
  await page.getByPlaceholder(/Napiš odpověď/i).fill('9');
  await saved;

  await page.getByRole('button', { name: /Zkontrolovat a odevzdat/i }).click();
  const dialog = page.getByTestId('review-submit-dialog');
  await expect(dialog).toBeVisible();
  const finished = page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/finish/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
    { timeout: 25_000 },
  );
  await dialog.getByTestId('confirm-submit').click();
  await finished;
}

test('10 students answer the same assignment in parallel — none lost', async ({
  browser,
  manifest,
  asRole,
}) => {
  test.slow();
  // use a fresh slice of 8.A students untouched by other specs
  const emails = manifest.students8A.slice(15, 15 + PARALLEL);
  expect(emails).toHaveLength(PARALLEL);

  const sessions = await Promise.all(
    emails.map((email, i) =>
      authedContext(browser, email, manifest.password, manifest.orgId, i + 1),
    ),
  );

  // 5xx guard across every context
  const serverErrors: string[] = [];
  for (const { page } of sessions) {
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });
  }

  // all answer + submit at once
  await Promise.all(
    sessions.map(({ page }) => answerAndSubmit(page, manifest.assignment8AId)),
  );

  expect(serverErrors, `no 5xx: ${serverErrors.join(', ')}`).toEqual([]);

  // ground truth via the teacher results API: 10 submitted, each with 3 answers
  const { page: teacher } = await asRole('teacher');
  const testId = await testIdOfAssignment(teacher, manifest.assignment8AId);
  const byTest = await teacher.request.get(`/api/tests/${testId}/results`);
  expect(byTest.ok()).toBeTruthy();
  const items = ((await byTest.json()).data.items ?? []) as Array<{
    submittedAt: string | null;
    student?: { name?: string };
    pendingCount?: number;
    correctCount?: number;
    incorrectCount?: number;
  }>;
  // results expose the student NAME, not email; the seed names 8.A students
  // "Žák 8.A #NN" where NN is the 1-based index in student-8a-NN@…
  const ourNames = new Set(
    emails.map((e) => `Žák 8.A #${Number(e.match(/student-8a-(\d+)@/)![1])}`),
  );
  const submittedForOurStudents = items.filter(
    (r) => r.submittedAt && r.student?.name && ourNames.has(r.student.name),
  );
  expect(submittedForOurStudents.length, 'all 10 submitted').toBe(PARALLEL);
  for (const row of submittedForOurStudents) {
    const answered =
      (row.correctCount ?? 0) + (row.incorrectCount ?? 0) + (row.pendingCount ?? 0);
    expect(answered, 'no lost answer (3 evaluated per submission)').toBe(3);
  }

  for (const { context } of sessions) await context.close();
});

/** Resolve a test id from one of its assignment ids (teacher-scoped). */
async function testIdOfAssignment(page: Page, assignmentId: string): Promise<string> {
  const res = await page.request.get(`/api/assignments/${assignmentId}`);
  const body = await res.json();
  return (body.data ?? body).testId as string;
}

test('a student who never submits is auto-submitted when the limit expires', async ({
  browser,
  manifest,
}) => {
  test.slow();
  const email = manifest.students8A[29]!; // student-8a-30, unused elsewhere
  const { context, page } = await authedContext(
    browser,
    email,
    manifest.password,
    manifest.orgId,
    50,
  );

  await page.goto(`/app/assignments/${manifest.assignmentFast8AId}/test`, {
    waitUntil: 'commit',
  });
  await expect(page.getByTestId('test-top-status-bar')).toBeVisible({ timeout: 30_000 });

  // answer one question, then DO NOT submit — the 20s limit must auto-submit
  await page.getByRole('radio', { name: /Ano/ }).check();
  const autoFinished = page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/finish/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
    { timeout: 40_000 },
  );
  await autoFinished; // fired by the timer, no manual click
  await context.close();
});
