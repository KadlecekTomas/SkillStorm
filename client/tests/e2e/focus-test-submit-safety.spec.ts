import {
  test,
  expect,
  type Page,
  openFocusTest,
  expectSaveStatus,
  expectReviewDialogOpen,
  expectSubmitBlockedBecause,
} from "./helpers/focus";

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
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("force every autosave to fail", () =>
      page.route(RESPONSES_ROUTE, (route) => route.abort()));

    const changed = await test.step("make an answer dirty", async () => {
      await page.getByTestId("question-nav-item").first().click();
      return makeDirtyChange(page);
    });
    test.skip(
      !changed,
      "Skipped because the first question exposed no answer control to change.",
    );

    await test.step("save status settles into error", () =>
      expectSaveStatus(page, "error"));

    await test.step("review dialog blocks submit with a save-error reason", async () => {
      await page.getByTestId("submit-test").click();
      await expectReviewDialogOpen(page);
      await expectSubmitBlockedBecause(page, "saveError");
    });

    await test.step("student can return to the test to recover", async () => {
      await page.getByRole("button", { name: /zpět do testu/i }).click();
      await expect(page.getByTestId("review-submit-dialog")).toBeHidden();
    });

    await page.unroute(RESPONSES_ROUTE);
  });

  test("blocks submit while a save is still in flight", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    // Hold the autosave request open so the UI stays in the "saving" state deterministically.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await test.step("hold the autosave request open", () =>
      page.route(RESPONSES_ROUTE, async (route) => {
        await held;
        await route.continue();
      }));

    const changed = await test.step("make an answer dirty", async () => {
      await page.getByTestId("question-nav-item").first().click();
      return makeDirtyChange(page);
    });
    test.skip(
      !changed,
      "Skipped because the first question exposed no answer control to change.",
    );

    await test.step("save status stays in-flight (saving)", () =>
      expectSaveStatus(page, "saving"));

    await test.step("review dialog blocks submit with an unsaved reason", async () => {
      await page.getByTestId("submit-test").click();
      await expectReviewDialogOpen(page);
      await expectSubmitBlockedBecause(page, "saving");
    });

    await page.getByRole("button", { name: /zpět do testu/i }).click();
    release();
    await page.unroute(RESPONSES_ROUTE);
  });
});
