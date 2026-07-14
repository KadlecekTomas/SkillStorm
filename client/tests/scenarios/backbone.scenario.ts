import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * BLOK 1 — full test lifecycle across roles, no manual DB writes.
 *
 * teacher: create test via wizard (3 question types) → publish → assign 8.A
 *   → student: answer, reload mid-test (autosave survives), submit
 *   → teacher: sees the submission + score
 *   → director: sees it in the dashboard aggregate
 *
 * Runs as one serial test so state flows between roles.
 */

const TITLE = `Životní cyklus ${Date.now()}`;

async function addQuestion(
  page: Page,
  index: number,
  type: 'TRUE_FALSE' | 'MULTIPLE_CHOICE' | 'FILL_IN_THE_BLANK',
  text: string,
  answer: { correct: string; options?: string[] },
) {
  await page.getByRole('button', { name: /Přidat otázku/i }).click();
  // the new question row appears; open its editor (nth matches creation order)
  const editButtons = page.getByRole('button', { name: /^Upravit$/ });
  await expect(editButtons.nth(index)).toBeVisible();
  await editButtons.nth(index).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Upravit otázku')).toBeVisible();
  await dialog.getByLabel(/Text otázky/i).fill(text);
  await dialog.getByLabel(/Typ otázky/i).selectOption(type);

  if (type === 'MULTIPLE_CHOICE') {
    const opts = answer.options ?? [];
    // ensure enough option rows exist
    while ((await dialog.getByPlaceholder('Text možnosti').count()) < opts.length) {
      await dialog.getByRole('button', { name: /Přidat možnost/i }).click();
    }
    const rows = dialog.getByPlaceholder('Text možnosti');
    for (let i = 0; i < opts.length; i++) await rows.nth(i).fill(opts[i]!);
    // mark the correct option's radio
    const correctIdx = opts.indexOf(answer.correct);
    await dialog.getByLabel('Správná možnost').nth(correctIdx).check();
  } else if (type === 'TRUE_FALSE') {
    await dialog.getByLabel(/Správná odpověď/i).selectOption(answer.correct);
  } else {
    await dialog.getByLabel(/Správná odpověď/i).fill(answer.correct);
  }

  await dialog.getByRole('button', { name: /^Uložit$/ }).click();
  await expect(dialog).not.toBeVisible();
}

test('celý životní cyklus testu — teacher → student → teacher → director', async ({
  asRole,
  manifest,
}) => {
  test.slow(); // multi-role UI flow with dev-server compiles

  // ── Teacher: create the test via the wizard ─────────────────────────────
  const { page: teacher } = await asRole('teacher');
  await teacher.goto('/app/tests/create', { waitUntil: 'commit' });
  await teacher.getByPlaceholder(/Písemka/i).fill(TITLE);
  // subject + topic are single <select>s seeded by scenarios-e2e.seed;
  // pick the first real option (index 1 — index 0 is the placeholder)
  await teacher.getByRole('combobox').first().selectOption({ index: 1 });
  await expect
    .poll(async () =>
      teacher.getByRole('combobox').nth(1).locator('option').count(),
    )
    .toBeGreaterThan(1);
  await teacher.getByRole('combobox').nth(1).selectOption({ index: 1 });
  // allowed grade 8 (checkbox in the grade grid)
  await teacher.getByRole('checkbox', { name: /8\./ }).check();
  await teacher.getByRole('button', { name: /Vytvořit test/i }).click();

  // lands on test detail; go to edit to add questions.
  // Match a real UUID id — a loose [0-9a-f-]+ also matches "/tests/create".
  const UUID = /\/app\/tests\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
  await teacher.waitForURL(UUID, { timeout: 30_000 });
  const testId = teacher.url().match(UUID)![1]!;
  await teacher.goto(`/app/tests/${testId}/edit`, { waitUntil: 'commit' });

  await addQuestion(teacher, 0, 'TRUE_FALSE', 'Je 3 liché číslo?', { correct: 'true' });
  await addQuestion(teacher, 1, 'MULTIPLE_CHOICE', 'Kolik je 5 + 4?', {
    correct: '9',
    options: ['9', '8', '7', '10'],
  });
  await addQuestion(teacher, 2, 'FILL_IN_THE_BLANK', 'Hlavní město Česka je ___', {
    correct: 'Praha',
  });

  // ── Publish + assign to 8.A (attempts = 1) ──────────────────────────────
  await teacher.goto(`/app/tests/${testId}`, { waitUntil: 'commit' });
  await teacher.getByRole('button', { name: /Publikovat test/i }).click();
  // assign modal opens after publish (or via "Zadat třídě")
  const assignClass = teacher.locator('#assign-class');
  if (!(await assignClass.isVisible().catch(() => false))) {
    await teacher.getByRole('button', { name: /Zadat|Přiřadit/i }).first().click();
  }
  await expect(assignClass).toBeVisible({ timeout: 15_000 });
  // topic select (auto from the test's catalog topic) → pick first real option
  const topicSelect = teacher.locator('#assign-topic');
  if (await topicSelect.isVisible().catch(() => false)) {
    await topicSelect.selectOption({ index: 1 }).catch(() => {});
  }
  // pick the 8.A option by resolving its value (labels vary / are not exact)
  const classValue = await assignClass
    .locator('option')
    .filter({ hasText: '8.A' })
    .first()
    .getAttribute('value');
  await assignClass.selectOption(classValue!);
  await teacher.locator('#assign-attempts').fill('1');
  await teacher.getByRole('button', { name: /^Přiřadit$/ }).click();
  await expect(teacher.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

  // ── Student: answer, reload mid-test (autosave), submit ─────────────────
  const { page: student } = await asRole('student8a');
  const overview = await student.request.get('/api/assignments/overview');
  const body = await overview.json();
  const active = (body.data ?? body).active as Array<{ assignmentId: string; testId: string }>;
  // 8.A also has the seeded assignment — target OUR test deterministically by id
  const mine = active.find((a) => a.testId === testId);
  expect(mine, 'student sees the newly assigned test').toBeTruthy();
  await student.goto(`/app/assignments/${mine!.assignmentId}/test`, { waitUntil: 'commit' });

  // old mode shows one question per screen; the navigator buttons carry
  // aria-label="Otázka N".
  const gotoQuestion = (n: number) =>
    student.getByRole('button', { name: `Otázka ${n}` }).click();

  // Q1 (TF): Ano
  await expect(student.getByText('Je 3 liché číslo?')).toBeVisible({ timeout: 20_000 });
  await student.getByRole('radio', { name: /Ano/ }).check();
  // Q2 (MC): 9 — wait for the autosave PATCH to actually persist before reload
  await gotoQuestion(2);
  await expect(student.getByText('Kolik je 5 + 4?')).toBeVisible();
  const saved = student.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 15_000 },
  );
  await student.getByRole('radio', { name: /^9$/ }).check();
  await saved;

  // ── reload mid-test: autosave must survive ──────────────────────────────
  await student.reload({ waitUntil: 'commit' });
  await expect(student.getByText('Je 3 liché číslo?')).toBeVisible({ timeout: 20_000 });
  await expect(student.getByRole('radio', { name: /Ano/ })).toBeChecked();
  await gotoQuestion(2);
  await expect(student.getByRole('radio', { name: /^9$/ })).toBeChecked();

  // Q3 (FITB) → submit
  await gotoQuestion(3);
  await expect(student.getByText(/Hlavní město Česka/)).toBeVisible();
  const savedFitb = student.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 15_000 },
  );
  await student.getByPlaceholder(/Napiš odpověď/i).fill('Praha');
  await savedFitb; // ensure the answer is persisted (review blocks on unsaved)

  await student.getByRole('button', { name: /Zkontrolovat a odevzdat/i }).click();
  const dialog = student.getByTestId('review-submit-dialog');
  await expect(dialog).toBeVisible();
  const finished = student.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/finish/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
    { timeout: 20_000 },
  );
  await dialog.getByTestId('confirm-submit').click();
  await finished; // submission is finalized server-side
  // and the student leaves the answering route
  await expect(student).not.toHaveURL(/\/assignments\/[^/]+\/test/, { timeout: 20_000 });

  // ── Teacher: sees the submission + score ────────────────────────────────
  const results = await teacher.request.get(`/api/tests/${testId}/results`);
  expect(results.ok()).toBeTruthy();
  const rBody = await results.json();
  const rows = ((rBody.data ?? rBody).items ?? []) as Array<{
    submittedAt: string | null;
    student?: { name?: string };
  }>;
  expect(rows.length, 'teacher sees the submission').toBeGreaterThan(0);
  expect(
    rows.some((r) => r.submittedAt),
    'at least one submission is submitted',
  ).toBeTruthy();

  // ── Director: dashboard aggregate reflects activity ─────────────────────
  const { page: director } = await asRole('director');
  const dash = await director.request.get('/api/dashboards/director');
  expect(dash.ok()).toBeTruthy();
  const dBody = (await dash.json()).data ?? (await dash.json());
  expect(dBody.submissionsThisWeek ?? 0).toBeGreaterThan(0);
});
