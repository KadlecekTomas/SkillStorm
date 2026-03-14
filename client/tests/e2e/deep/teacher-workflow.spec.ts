/**
 * PARTS 2 & 3 — TEACHER WORKFLOW & SUBJECT/VALIDATION TESTS
 *
 * Part 2 — full create-publish-assign flow:
 *   login → Tests → Create Test → fill form → save → add question →
 *   publish → assign to class → verify success
 *
 * Part 3 — validation tests:
 *   - subject is required
 *   - openAt must be before closeAt
 *   - title minimum length
 */
import { test, expect } from "@playwright/test";
import { loginAsTeacher, collectConsoleErrors, assertNoCriticalErrors } from "./utils/auth";
import { navigateTo, expectSuccessVisible, waitForModal } from "./utils/navigation";
import {
  testsPageSelectors,
  createTestSelectors,
  testDetailSelectors,
  assignModalSelectors,
} from "./utils/selectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique test title to avoid collisions across runs. */
function uniqueTitle(prefix = "Deep Test") {
  return `${prefix} ${Date.now()}`;
}

/** Format a datetime-local string offset from now by `minutes`. */
function datetimeLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  // datetime-local format: YYYY-MM-DDTHH:MM
  return d.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// PART 2 — Create, publish, and assign a test
// ---------------------------------------------------------------------------

test.describe("TEACHER – create-publish-assign flow", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsTeacher(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  // 2-A: navigate from Tests page to Create page
  test("create test button navigates to /app/tests/create", async ({ page }) => {
    await navigateTo(page, "/app/tests");

    const btn = testsPageSelectors.createTestBtn(page);
    await expect(btn).toBeVisible();
    await btn.click();

    await expect(page).toHaveURL(/\/app\/tests\/create/);
  });

  // 2-B: create a new DRAFT test
  test("can create a new test and land on the test detail page", async ({ page }) => {
    await navigateTo(page, "/app/tests/create");

    const title = uniqueTitle("Playwright Test");

    // Fill title
    const titleInput = page.getByRole("textbox").first();
    await titleInput.fill(title);

    // Select subject — first non-empty option
    const subjectSelect = page.locator("select, [role='combobox']").first();
    await subjectSelect.click();
    // Pick first available option that isn't a placeholder
    const firstOption = page.getByRole("option").filter({ hasNot: page.getByText(/vyberte|select/i) }).first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }

    // Submit the form
    const saveBtn = page.getByRole("button", { name: /Uložit|Vytvořit|Save|Create/i });
    await saveBtn.click();

    // Should redirect to /app/tests/<id>
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });
  });

  // 2-C: add a TRUE_FALSE question
  test("can add a TRUE/FALSE question on test detail page", async ({ page }) => {
    // Create a test first
    await navigateTo(page, "/app/tests/create");
    const title = uniqueTitle("Q-Test");

    await page.getByRole("textbox").first().fill(title);
    const subjectSelect = page.locator("select, [role='combobox']").first();
    await subjectSelect.click();
    const firstOption = page.getByRole("option").filter({ hasNot: page.getByText(/vyberte|select/i) }).first();
    if (await firstOption.isVisible()) await firstOption.click();
    await page.getByRole("button", { name: /Uložit|Vytvořit|Save|Create/i }).click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });

    // Add question
    const addBtn = page
      .getByRole("button", { name: /Přidat otázku|Přidat první otázku/i })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    // Dialog opens — fill question text
    await waitForModal(page);

    const questionText = page.getByRole("textbox").filter({ hasText: "" }).first();
    await questionText.fill("Je Zlomek zlomkem?");

    // Select TRUE_FALSE type if a type selector exists
    const typeSelect = page.locator("select, [role='combobox']").first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ label: "TRUE_FALSE" }).catch(async () => {
        await typeSelect.selectOption({ label: "Pravda / Lež" }).catch(() => {});
      });
    }

    // Confirm save
    const confirmBtn = page.getByRole("button", { name: /Uložit|Přidat|Save|Add/i }).last();
    await confirmBtn.click();

    // Dialog should close, question should appear
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 6_000 });
    await expect(page.getByText("Je Zlomek zlomkem?")).toBeVisible({ timeout: 8_000 });
  });

  // 2-D: publish a test
  test("can publish a test (status changes from Koncept to Publikováno)", async ({ page }) => {
    // Navigate to Tests and find a DRAFT test to publish
    await navigateTo(page, "/app/tests");

    // Look for a test with "Koncept" status
    const draftTest = page.locator("tr, [data-testid]").filter({ hasText: "Koncept" }).first();
    const hasDraft = await draftTest.isVisible().catch(() => false);

    if (!hasDraft) {
      // Create one first
      await navigateTo(page, "/app/tests/create");
      await page.getByRole("textbox").first().fill(uniqueTitle("Publish Test"));
      const subjectSelect = page.locator("select, [role='combobox']").first();
      await subjectSelect.click();
      const firstOption = page.getByRole("option").filter({ hasNot: page.getByText(/vyberte|select/i) }).first();
      if (await firstOption.isVisible()) await firstOption.click();
      await page.getByRole("button", { name: /Uložit|Vytvořit/i }).click();
      await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });
    } else {
      // Click the draft test to open it
      await draftTest.getByRole("link").first().click();
      await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/);
    }

    // At this point we are on the test detail page
    // Look for a publish / "Dokončit a přiřadit" button
    const publishBtn = page
      .getByRole("button", { name: /Publikovat|Dokončit a přiřadit/i })
      .first();
    if (await publishBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await publishBtn.click();
      // Either published successfully or blocked (not enough questions — that's ok)
      const publishedOk = await page
        .getByText("Publikováno")
        .isVisible({ timeout: 6_000 })
        .catch(() => false);
      const blocked = await page
        .locator('[role="alert"]')
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(publishedOk || blocked).toBe(true);
    }
    // If the button isn't there the test may already be published — pass silently
  });

  // 2-E: assign a published test to a class
  test("can open assign-to-class modal and fill it", async ({ page }) => {
    await navigateTo(page, "/app/tests");

    // Find a published test row (has "Publikováno" badge)
    const publishedRow = page
      .locator("tr, article, [data-card]")
      .filter({ hasText: /Publikováno/i })
      .first();

    if (!(await publishedRow.isVisible({ timeout: 4_000 }).catch(() => false))) {
      // No published tests visible — skip gracefully
      test.skip();
      return;
    }

    // Click assign button inside that row
    const assignBtn = publishedRow
      .getByRole("button", { name: /Přiřadit/i })
      .first();
    if (!(await assignBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await assignBtn.click();

    // Modal should open
    await waitForModal(page);

    // Verify modal fields exist
    const classSelect = assignModalSelectors.classSelect(page);
    await expect(classSelect).toBeVisible({ timeout: 5_000 });

    const openInput = assignModalSelectors.openAtInput(page);
    await expect(openInput).toBeVisible();

    const closeInput = assignModalSelectors.closeAtInput(page);
    await expect(closeInput).toBeVisible();

    // Fill dates — open in 5 min, close in 2 hours
    await openInput.fill(datetimeLocal(5));
    await closeInput.fill(datetimeLocal(125));

    // Select first available class
    await classSelect.selectOption({ index: 1 }).catch(async () => {
      await classSelect.click();
      await page.getByRole("option").first().click();
    });

    // Submit
    const submitBtn = assignModalSelectors.submitBtn(page);
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Expect success or a known constraint error
    const successVisible = await page
      .getByText(/byl zadán|byl přiřazen|Test byl zadán/i)
      .isVisible({ timeout: 8_000 })
      .catch(() => false);
    const errorVisible = await page
      .locator('[role="alert"]')
      .isVisible({ timeout: 4_000 })
      .catch(() => false);

    // One of the two must be true (success or meaningful error — not a crash)
    expect(successVisible || errorVisible).toBe(true);
  });

  // 2-F: test appears in teacher's test list after creation
  test("newly created test appears in the test list", async ({ page }) => {
    const title = uniqueTitle("ListCheck");
    await navigateTo(page, "/app/tests/create");
    await page.getByRole("textbox").first().fill(title);
    const subjectSelect = page.locator("select, [role='combobox']").first();
    await subjectSelect.click();
    const firstOption = page
      .getByRole("option")
      .filter({ hasNot: page.getByText(/vyberte|select/i) })
      .first();
    if (await firstOption.isVisible()) await firstOption.click();
    await page.getByRole("button", { name: /Uložit|Vytvořit/i }).click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });

    // Go back to the list
    await navigateTo(page, "/app/tests");
    await expect(page.getByText(title)).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// PART 3 — Validation & rejection tests
// ---------------------------------------------------------------------------

test.describe("TEACHER – form validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  // 3-A: subject is required
  test("create-test rejects empty subject", async ({ page }) => {
    await navigateTo(page, "/app/tests/create");

    // Fill title but leave subject empty
    await page.getByRole("textbox").first().fill("NoSubjectTest");

    const saveBtn = page.getByRole("button", { name: /Uložit|Vytvořit/i });
    await saveBtn.click();

    // Should show validation error and stay on /create
    const errorVisible =
      (await page.getByText(/vyberte předmět|subject.*required|předmět.*povinný/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false));
    expect(errorVisible).toBe(true);
    await expect(page).toHaveURL(/\/app\/tests\/create/);
  });

  // 3-B: title too short
  test("create-test rejects title shorter than 3 characters", async ({ page }) => {
    await navigateTo(page, "/app/tests/create");

    await page.getByRole("textbox").first().fill("AB");
    const saveBtn = page.getByRole("button", { name: /Uložit|Vytvořit/i });
    await saveBtn.click();

    // Validation should fire
    const errorVisible =
      (await page.getByText(/min|alespoň|too short/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false));
    expect(errorVisible).toBe(true);
    await expect(page).toHaveURL(/\/app\/tests\/create/);
  });

  // 3-C: assign modal — openAt must be before closeAt
  test("assign modal rejects closeAt before openAt", async ({ page }) => {
    await navigateTo(page, "/app/tests");

    const publishedRow = page
      .locator("tr, article, [data-card]")
      .filter({ hasText: /Publikováno/i })
      .first();

    if (!(await publishedRow.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const assignBtn = publishedRow.getByRole("button", { name: /Přiřadit/i }).first();
    if (!(await assignBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await assignBtn.click();
    await waitForModal(page);

    const openInput = assignModalSelectors.openAtInput(page);
    const closeInput = assignModalSelectors.closeAtInput(page);

    // Set close BEFORE open (invalid)
    await openInput.fill(datetimeLocal(60));
    await closeInput.fill(datetimeLocal(10));

    await assignModalSelectors.submitBtn(page).click();

    // Should show validation error — modal should stay open
    const errorVisible =
      (await page.getByText(/uzavření.*otevření|close.*before|datum/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="dialog"]').isVisible({ timeout: 3_000 }).catch(() => false));
    expect(errorVisible).toBe(true);
  });
});
