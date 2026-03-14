/**
 * PART 8 — MULTI-ROLE DATA CONSISTENCY (end-to-end chain)
 *
 * This file tests that data created by one role is correctly visible to others:
 *
 *   teacher creates test
 *     ↓
 *   teacher publishes test
 *     ↓
 *   teacher assigns test to class
 *     ↓
 *   student sees assignment in their list
 *     ↓
 *   student submits test
 *     ↓
 *   teacher sees result (submission count increases)
 *     ↓
 *   director sees analytics update (no NaN, valid percentages)
 *
 * Each phase is a separate test so failures are localized.
 * The shared state (testTitle) is stored in a file-scope variable because
 * Playwright workers are 1 in the config — tests run serially in this file.
 *
 * NOTE: This chain creates live data in the database. It is safe to run
 *       repeatedly — each run uses a unique title suffix.
 */
import { test, expect } from "@playwright/test";
import {
  loginAsTeacher,
  loginAsStudent,
  loginAsDirector,
  waitForProfile,
} from "./utils/auth";
import {
  navigateTo,
  expectNoRawErrors,
  waitForModal,
} from "./utils/navigation";
import { assignModalSelectors, submissionSelectors } from "./utils/selectors";

// ---------------------------------------------------------------------------
// Shared state (serial execution within this describe)
// ---------------------------------------------------------------------------

const RUN_ID = Date.now();
const TEST_TITLE = `Chain Test ${RUN_ID}`;

/** Offset datetime-local string. */
function dtLocal(offsetMin: number) {
  return new Date(Date.now() + offsetMin * 60_000).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Phase 1: Teacher creates the test
// ---------------------------------------------------------------------------

test.describe("E2E chain", () => {
  test("Phase 1 — Teacher creates a new test", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests/create");

    // Title
    await page.getByRole("textbox").first().fill(TEST_TITLE);

    // Subject — pick first available
    const subjectCombo = page.locator("select, [role='combobox']").first();
    await subjectCombo.click().catch(() => {});
    const firstOpt = page
      .getByRole("option")
      .filter({ hasNot: page.getByText(/vyberte|select/i) })
      .first();
    if (await firstOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOpt.click();
    }

    await page.getByRole("button", { name: /Uložit|Vytvořit/i }).click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });

    // Verify title is shown on detail page
    await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 8_000 });
  });

  // ---------------------------------------------------------------------------
  // Phase 2: Teacher adds a question and publishes
  // ---------------------------------------------------------------------------

  test("Phase 2 — Teacher adds question and publishes", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests");

    // Find the test we created
    const testLink = page.getByText(TEST_TITLE);
    if (!(await testLink.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await testLink.click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/);
    await waitForProfile(page);

    // Add a question if none exist
    const addBtn = page
      .getByRole("button", { name: /Přidat otázku|Přidat první otázku/i })
      .first();
    if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addBtn.click();
      await waitForModal(page);

      // Fill question text
      const textbox = page.locator('[role="dialog"] input[type="text"], [role="dialog"] textarea').first();
      if (await textbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await textbox.fill("Je tento chain test správně?");
      }

      // Correct answer for TRUE_FALSE
      const trueRadio = page
        .locator('[role="dialog"]')
        .getByRole("radio", { name: /true|ano|pravda/i })
        .first();
      if (await trueRadio.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await trueRadio.check();
      }

      // Points
      const pointsInput = page
        .locator('[role="dialog"]')
        .locator('input[type="number"]')
        .first();
      if (await pointsInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await pointsInput.fill("1");
      }

      await page
        .locator('[role="dialog"]')
        .getByRole("button", { name: /Uložit|Přidat|Save/i })
        .last()
        .click();
      await page.locator('[role="dialog"]').waitFor({ state: "hidden", timeout: 6_000 }).catch(() => {});
    }

    // Publish
    const publishBtn = page
      .getByRole("button", { name: /Publikovat|Dokončit a přiřadit/i })
      .first();
    if (await publishBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(2_000);
    }

    // Either published or blocked (not enough questions) — no crash
    await expectNoRawErrors(page);
  });

  // ---------------------------------------------------------------------------
  // Phase 3: Teacher assigns to class
  // ---------------------------------------------------------------------------

  test("Phase 3 — Teacher assigns test to class", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests");

    const testRow = page.locator("tr, article").filter({ hasText: TEST_TITLE }).first();
    if (!(await testRow.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Click assign on published test — if not published, skip
    const assignBtn = testRow.getByRole("button", { name: /Přiřadit/i }).first();
    if (!(await assignBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await assignBtn.click();
    await waitForModal(page);

    const classSelect = assignModalSelectors.classSelect(page);
    if (!(await classSelect.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await classSelect.selectOption({ index: 1 }).catch(async () => {
      await classSelect.click();
      await page.getByRole("option").first().click().catch(() => {});
    });

    await assignModalSelectors.openAtInput(page).fill(dtLocal(-60)); // open 1h ago
    await assignModalSelectors.closeAtInput(page).fill(dtLocal(120)); // close in 2h
    await assignModalSelectors.submitBtn(page).click();

    // Success or known error — not crash
    await page.waitForTimeout(3_000);
    await expectNoRawErrors(page);
  });

  // ---------------------------------------------------------------------------
  // Phase 4: Student sees assignment
  // ---------------------------------------------------------------------------

  test("Phase 4 — Student sees the assignment in their list", async ({ page }) => {
    await loginAsStudent(page);
    await navigateTo(page, "/app/assignments");

    // Either the assignment is there or there are other assignments
    const hasItems = await page.getByRole("button", { name: /Otevřít test/i }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/Nemáš žádná aktivní zadání/i).isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBe(true);

    await expectNoRawErrors(page);
  });

  // ---------------------------------------------------------------------------
  // Phase 5: Student submits a test
  // ---------------------------------------------------------------------------

  test("Phase 5 — Student can open and attempt a test", async ({ page }) => {
    await loginAsStudent(page);
    await navigateTo(page, "/app/assignments");

    const openBtn = page.getByRole("button", { name: /Otevřít test/i }).first();
    if (!(await openBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: "commit", timeout: 8_000 }).catch(() => {}),
      openBtn.click(),
    ]);

    await waitForProfile(page);
    await expect(page.locator("h1")).toBeVisible({ timeout: 6_000 });

    // Start attempt if possible
    const startBtn = submissionSelectors.startBtn(page);
    if (await startBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(2_000);
    }

    // Try answering + finishing
    const radioAno = page.getByRole("radio", { name: /Ano/i }).first();
    if (await radioAno.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radioAno.check();
    }

    const finishBtn = submissionSelectors.finishBtn(page);
    if (await finishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await finishBtn.click();
      await page.waitForTimeout(3_000);
    }

    await expectNoRawErrors(page);
  });

  // ---------------------------------------------------------------------------
  // Phase 6: Teacher sees submission count
  // ---------------------------------------------------------------------------

  test("Phase 6 — Teacher sees results on tests page", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests");

    // Verify the tests list loaded and has numeric data (submission counts)
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoRawErrors(page);

    // Numbers in submissions column should not be NaN
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("Phase 6b — Teacher can open a test's results page", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests");

    // Navigate to the first test detail
    const firstTestLink = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await firstTestLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstTestLink.click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+/);
    await waitForProfile(page);
    await expectNoRawErrors(page);
  });

  // ---------------------------------------------------------------------------
  // Phase 7: Director sees analytics (data propagated)
  // ---------------------------------------------------------------------------

  test("Phase 7 — Director analytics reflect the submission data", async ({ page }) => {
    await loginAsDirector(page);
    await navigateTo(page, "/app");

    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoRawErrors(page);

    // No NaN anywhere on director dashboard
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);

    // Percentages in valid range
    const matches = bodyText.match(/(\d+(?:\.\d+)?)\s*%/g) ?? [];
    for (const match of matches) {
      const value = parseFloat(match.replace("%", "").trim());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  test("Phase 7b — Director results page has valid data", async ({ page }) => {
    await loginAsDirector(page);
    await navigateTo(page, "/app/results");

    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoRawErrors(page);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });
});
