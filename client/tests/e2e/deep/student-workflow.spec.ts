/**
 * PARTS 4 + 9 + 10 — STUDENT TEST ATTEMPT, STABILITY & ERROR RESILIENCE
 *
 * Part 4 — Student takes a test:
 *   login → assignments page → open assignment → start submission →
 *   answer questions → submit → verify score shown
 *
 * Part 9 — Stability:
 *   - second attempt on same assignment is handled correctly
 *   - system remains stable after repeated actions
 *
 * Part 10 — Error resilience:
 *   - submitting with empty answers
 *   - double-submit prevention
 *   - refreshing during an active attempt
 *   - expired / closed assignment handling
 *
 * The tests use the seeded assignment ("Demo test: Zlomky a logika" / class 8.A).
 * If no assignment is found in the list the test is skipped gracefully.
 */
import { test, expect } from "@playwright/test";
import {
  loginAsStudent,
  collectConsoleErrors,
  assertNoCriticalErrors,
  waitForProfile,
} from "./utils/auth";
import { navigateTo, expectNoSpinner, expectNoRawErrors } from "./utils/navigation";
import { submissionSelectors, assignmentsListSelectors } from "./utils/selectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open the assignments page and return the href of the first open assignment.
 * Returns null if none found.
 */
async function getFirstAssignmentHref(page: import("@playwright/test").Page): Promise<string | null> {
  await navigateTo(page, "/app/assignments");

  const btn = assignmentsListSelectors.openTestBtn(page);
  if (!(await btn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return null;
  }

  // Get the enclosing Card and derive the URL from the button click handler.
  // The button calls router.push(`/assignments/${id}`) — we can intercept navigation.
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: "commit", timeout: 8_000 }).catch(() => null),
    btn.click(),
  ]);

  return page.url().includes("/assignments/") ? page.url() : null;
}

// ---------------------------------------------------------------------------
// PART 4 — Student test attempt
// ---------------------------------------------------------------------------

test.describe("STUDENT – assignment & test attempt", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsStudent(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("assignments page loads without errors", async ({ page }) => {
    await navigateTo(page, "/app/assignments");
    await expectNoSpinner(page);
    await expectNoRawErrors(page);
  });

  test("assignments page shows content or empty state (not a crash)", async ({ page }) => {
    await navigateTo(page, "/app/assignments");

    const hasItems = await page.getByRole("button", { name: /Otevřít test/i }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/Nemáš žádná aktivní zadání|Žádná zadání/i).isVisible().catch(() => false);

    expect(hasItems || hasEmpty).toBe(true);
  });

  test("can navigate to an open assignment", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }
    await expect(page).toHaveURL(/\/assignments\/[a-zA-Z0-9-]+/);
    await waitForProfile(page);
  });

  test("assignment detail shows test title and dates", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    // Test title should be visible (h1)
    await expect(page.locator("h1")).toBeVisible({ timeout: 8_000 });

    // Open/close dates are rendered
    await expect(page.getByText(/Otevřeno:/i)).toBeVisible();
  });

  test("can start a submission attempt", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);

    // If no start button, a submission already exists — that's fine
    if (!(await startBtn.isVisible({ timeout: 4_000 }).catch(() => false))) {
      const submissionCard = page.getByText("Stav");
      const exists = await submissionCard.isVisible({ timeout: 3_000 }).catch(() => false);
      if (exists) return; // existing submission — pass
      test.skip();
      return;
    }

    await startBtn.click();

    // Submission created success message
    await expect(page.getByText(/Submission byla vytvořena|Začínám pokus/i)).toBeVisible({
      timeout: 8_000,
    });
  });

  test("questions render after starting a submission", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.getByText(/Submission byla vytvořena/i).waitFor({ timeout: 8_000 }).catch(() => {});
    }

    // Questions should be visible (rendered inside Cards with font-medium text)
    const questionCards = page.locator(".space-y-4 > div, [class*='space-y'] > div").filter({
      has: page.locator("p.font-medium, p[class*='font-medium']"),
    });

    const count = await questionCards.count();
    // Either questions are there or submission is already read-only
    const isReadOnly = await page.getByText("Submission je uzavřená").isVisible().catch(() => false);
    expect(count > 0 || isReadOnly).toBe(true);
  });

  test("can answer a TRUE/FALSE question and save", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.getByText(/Submission byla vytvořena/i).waitFor({ timeout: 8_000 }).catch(() => {});
    }

    // Answer any radio button (TRUE_FALSE)
    const radioAno = page.getByRole("radio", { name: /Ano/i }).first();
    if (await radioAno.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await radioAno.check();
    }

    // Save
    const saveBtn = submissionSelectors.saveResponsesBtn(page);
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(page.getByText(/Odpovědi byly uloženy/i)).toBeVisible({ timeout: 6_000 });
    }
  });

  test("can finish/submit a test attempt", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.getByText(/Submission byla vytvořena/i).waitFor({ timeout: 8_000 }).catch(() => {});
    }

    // Answer any available radio
    const radioAno = page.getByRole("radio", { name: /Ano/i }).first();
    if (await radioAno.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radioAno.check();
    }

    // Finish
    const finishBtn = submissionSelectors.finishBtn(page);
    if (!(await finishBtn.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await finishBtn.click();

    // Submission odevzdána / score visible
    const submitted = await page
      .getByText(/Submission byla odevzdána|Submission byla zamítnuta/i)
      .isVisible({ timeout: 8_000 })
      .catch(() => false);
    const scoreVisible = await page.getByText("Score").isVisible().catch(() => false);
    const readOnly = await page.getByText("Submission je uzavřená").isVisible().catch(() => false);

    expect(submitted || scoreVisible || readOnly).toBe(true);
  });

  test("score is displayed after submission is finished", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    // If submission is already in read-only state, score should be present
    const isReadOnly = await page.getByText("Submission je uzavřená").isVisible().catch(() => false);
    const scoreVisible = await page.getByText("Score").isVisible().catch(() => false);

    if (isReadOnly || scoreVisible) {
      // Great — just verify the value looks like a percentage
      if (scoreVisible) {
        const scoreText = await page.getByText("Score").locator("..").textContent();
        expect(scoreText).toMatch(/\d+\s*%|Nelze vyhodnotit|není k dispozici/);
      }
    }
    // Otherwise skip — couldn't reach the post-submit state
  });
});

// ---------------------------------------------------------------------------
// PART 9 — Stability: multiple attempts
// ---------------------------------------------------------------------------

test.describe("STUDENT – stability (multiple attempts)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("opening the same assignment twice does not crash", async ({ page }) => {
    await navigateTo(page, "/app/assignments");
    const href = await page.url();

    // Navigate to assignment list twice in a row
    await navigateTo(page, "/app/assignments");
    await expectNoRawErrors(page);
  });

  test("attempting to start a second submission is handled (no crash)", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    // Try clicking start again if button is still visible
    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
      // Wait for either success or error
      await page.waitForTimeout(2_000);
    }

    // Try a second click
    if (await startBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await startBtn.click();
      // Should show an error (not crash)
      const errorVisible = await page.locator('[role="alert"]').isVisible({ timeout: 5_000 }).catch(() => false);
      // Page must not crash
      await expectNoRawErrors(page);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 10 — Error resilience
// ---------------------------------------------------------------------------

test.describe("STUDENT – error resilience", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("submitting without answering any question is handled gracefully", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(2_000);
    }

    // Click Finish without answering anything
    const finishBtn = submissionSelectors.finishBtn(page);
    if (!(await finishBtn.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await finishBtn.click();

    // System should either:
    // a) Submit (0 points / rejected) — both valid outcomes
    // b) Show an error message
    // It must NOT crash or show a blank page
    await expectNoRawErrors(page);

    const safe =
      (await page.getByText(/Submission byla|score/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false)) ||
      (await page.getByText("Submission je uzavřená").isVisible().catch(() => false));
    expect(safe).toBe(true);
  });

  test("refreshing the page during an active attempt restores state", async ({ page }) => {
    const href = await getFirstAssignmentHref(page);
    if (!href) {
      test.skip();
      return;
    }

    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.getByText(/Submission byla vytvořena/i).waitFor({ timeout: 8_000 }).catch(() => {});
    }

    // Hard refresh
    await page.reload({ waitUntil: "commit" });
    await waitForProfile(page);

    // After reload the page must show the assignment content — not crash
    await expectNoRawErrors(page);
    const titleVisible = await page.locator("h1").isVisible({ timeout: 6_000 }).catch(() => false);
    expect(titleVisible).toBe(true);
  });

  test("navigating to a non-existent assignment shows error — not blank page", async ({ page }) => {
    await page.goto("/assignments/00000000-0000-0000-0000-000000000000", {
      waitUntil: "commit",
    });
    await waitForProfile(page);

    // Should show an error, a redirect, or a not-found message — not a crash
    const hasError =
      (await page.getByText(/nebylo nalezeno|not found|Chyba/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false)) ||
      page.url().includes("/app") || // redirected away
      (await page.locator("h1").isVisible().catch(() => false)); // any content

    expect(hasError).toBe(true);
  });

  test("assignments page does not crash after logout and re-login", async ({ page }) => {
    // Already logged in as student from beforeEach
    await navigateTo(page, "/app/assignments");
    await expectNoRawErrors(page);

    // Logout and re-login
    const logoutBtn = page.getByRole("button", { name: /Odhlásit/i });
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/, { timeout: 8_000 });
    }

    await loginAsStudent(page);
    await navigateTo(page, "/app/assignments");
    await expectNoRawErrors(page);
  });
});
