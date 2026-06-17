import { test, expect, type Page } from "@playwright/test";
import { openFocusTest } from "./helpers/focus";

/**
 * Focus Test Mode — submit safety.
 *
 * A test must never be finalized while answers are not safely persisted. These tests force the
 * autosave PATCH into a failed / in-flight state via route interception (deterministic, no
 * fixed waits) and assert the review dialog blocks "Odevzdat test" and explains why.
 */

const RESPONSES_ROUTE = "**/submissions/*/responses";

/** Make a dirty change on the current question regardless of its type or prior answer. */
async function makeDirtyChange(page: Page): Promise<boolean> {
  const options = page.getByTestId("answer-option");
  const n = await options.count();
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      if ((await options.nth(i).getAttribute("data-selected")) === "false") {
        await options.nth(i).click();
        return true;
      }
    }
    await options.nth(0).click();
    return true;
  }
  const fill = page.getByPlaceholder("Napiš odpověď");
  if (await fill.isVisible().catch(() => false)) {
    await fill.fill(`dirty-${Date.now()}`);
    return true;
  }
  return false;
}

test.describe("Focus Test Mode — submit safety", () => {
  test("blocks submit when a save has failed and explains why", async ({
    page,
  }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    // Force every autosave to fail.
    await page.route(RESPONSES_ROUTE, (route) => route.abort());

    await page.getByTestId("question-nav-item").first().click();
    const changed = await makeDirtyChange(page);
    test.skip(!changed, "First question exposed no answerable control.");

    // Autosave settles into the error state (after the debounce + failed flush).
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "error",
      { timeout: 10_000 },
    );

    // The review dialog blocks the final submit and shows the reason.
    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("confirm-submit")).toBeDisabled();
    await expect(page.getByTestId("review-save-error-warning")).toBeVisible();

    // The student can still return to the test to recover.
    await page.getByRole("button", { name: /zpět do testu/i }).click();
    await expect(page.getByTestId("review-submit-dialog")).toBeHidden();

    await page.unroute(RESPONSES_ROUTE);
  });

  test("blocks submit while a save is still in flight", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    // Hold the autosave request open so the UI stays in the "saving" state deterministically.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(RESPONSES_ROUTE, async (route) => {
      await held;
      await route.continue();
    });

    await page.getByTestId("question-nav-item").first().click();
    const changed = await makeDirtyChange(page);
    test.skip(!changed, "First question exposed no answerable control.");

    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saving",
      { timeout: 10_000 },
    );

    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("confirm-submit")).toBeDisabled();
    await expect(page.getByTestId("review-unsaved-warning")).toBeVisible();

    await page.getByRole("button", { name: /zpět do testu/i }).click();

    // Release the held request and clean up.
    release();
    await page.unroute(RESPONSES_ROUTE);
  });
});
