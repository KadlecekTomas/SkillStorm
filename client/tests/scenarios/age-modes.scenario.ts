import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * BLOK 3 — age-appropriate answering modes.
 *
 * The mode is derived from the student's ACTIVE enrollment grade (server
 * test-session → student.grade), never from a client override for real use:
 *   2.A (GRADE_2)          → young (tiles, Parťák companion, muted timer)
 *   8.A (GRADE_8)          → old   (list, 1–4 keyboard, full timer)
 *   1.SŠ (HIGH_SCHOOL_*)   → old   (grade unparsable to 1–9 → safe fallback)
 * ?mode= is presentation-only: it may flip the look but must never change
 * any request payload.
 */

/**
 * Open a specific assignment in Focus Test Mode. Navigating by a known id
 * (from the seed manifest) is resilient: once a student starts a
 * single-attempt assignment it drops out of the "active" overview, so
 * successive specs sharing a student must not rely on that list.
 */
async function openAssignment(
  page: Page,
  assignmentId: string,
  query = '',
): Promise<void> {
  await page.goto(`/app/assignments/${assignmentId}/test${query}`, {
    waitUntil: 'commit',
  });
  await expect(page.getByTestId('test-top-status-bar')).toBeVisible({ timeout: 20_000 });
}

// Young mode shows the Parťák companion and NO question navigator; old mode
// shows the "Přehled otázek" navigator.
const navigator = (p: Page) => p.getByText('Přehled otázek');
const buddy = (p: Page) => p.getByText(/Zvládneš to|Super, jedeme dál/);

test('2.A → young mode (tiles, Parťák) derived from enrollment', async ({ asRole, manifest }) => {
  const { page } = await asRole('student2a');
  await openAssignment(page, manifest.assignment2AId);
  await expect(buddy(page)).toBeVisible();
  await expect(navigator(page)).toBeHidden();
  // young MC options render as tiles (answer-option testid present, 4 options)
  await expect(page.getByTestId('answer-option').first()).toBeVisible();
});

test('8.A → old mode (list + navigator) derived from enrollment', async ({ asRole, manifest }) => {
  const { page } = await asRole('student8a');
  await openAssignment(page, manifest.assignment8AId);
  await expect(navigator(page)).toBeVisible();
  await expect(buddy(page)).toBeHidden();
});

test('HS grade is unparsable → old mode fallback', async ({ asRole, manifest }) => {
  const { page } = await asRole('studentHs');
  await openAssignment(page, manifest.assignmentHSId);
  // HIGH_SCHOOL_YEAR_1 → parseGradeNumber null → old
  await expect(navigator(page)).toBeVisible();
  await expect(buddy(page)).toBeHidden();
});

test('keyboard answering: pressing "2" selects the second option', async ({ asRole, manifest }) => {
  const { page } = await asRole('student8a');
  await openAssignment(page, manifest.assignment8AId);
  // Q1 of "Matematika 8.A" is TRUE_FALSE (Ano=1 / Ne=2)
  await expect(page.getByText(/prvočíslo/)).toBeVisible();
  await page.locator('body').press('2');
  await expect(page.getByRole('radio', { name: /Ne/ })).toBeChecked();
});

test('?mode= override changes presentation but never a request payload', async ({ asRole, manifest }) => {
  const { page } = await asRole('student8a');
  // capture every mutating request while overriding to young
  const offenders: string[] = [];
  page.on('request', (req) => {
    const method = req.method();
    if (method === 'GET') return;
    const url = req.url();
    const post = req.postData() ?? '';
    if (/[?&]mode=/.test(url) || /"mode"|'mode'/.test(post)) {
      offenders.push(`${method} ${url} :: ${post.slice(0, 120)}`);
    }
  });

  await openAssignment(page, manifest.assignment8AId, '?mode=young');

  // 8.A is old by grade, but ?mode=young forces the young presentation…
  await expect(buddy(page)).toBeVisible();
  await expect(navigator(page)).toBeHidden();

  // …and answering still saves, with no `mode` leaking into any payload
  await page.getByTestId('answer-option').first().click();
  await page.waitForResponse(
    (r) => /\/submissions\/[0-9a-f-]+\/responses/.test(r.url()) && r.request().method() === 'PATCH',
    { timeout: 15_000 },
  );
  expect(offenders, `no request may carry mode: ${offenders.join(' | ')}`).toEqual([]);
});
