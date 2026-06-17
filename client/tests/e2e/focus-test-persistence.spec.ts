import {
  test,
  expect,
  type Page,
  openFocusTest,
  firstUnansweredIndex,
  expectSaved,
} from "./helpers/focus";

/**
 * Focus Test Mode — answer persistence.
 *
 * Focus Test Mode autosaves answers to the backend (PATCH responses) and keeps a local draft,
 * so answers must survive both in-session navigation and a full page reload (resume). Tests
 * target a genuinely unanswered question so they stay valid on a resumed attempt.
 */

const FILL_VALUE = "persist-42";

/** Answer the current question; returns its control kind so callers can verify the right way. */
async function answerAndDetect(page: Page): Promise<"option" | "fill" | null> {
  const option = page.getByTestId("answer-option").first();
  const fill = page.getByPlaceholder("Napiš odpověď");
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return "option";
  }
  if (await fill.isVisible().catch(() => false)) {
    await fill.fill(FILL_VALUE);
    return "fill";
  }
  return null;
}

async function expectAnswerPresent(
  page: Page,
  kind: "option" | "fill",
): Promise<void> {
  if (kind === "option") {
    await expect(
      page.locator('[data-testid="answer-option"][data-selected="true"]'),
    ).toHaveCount(1);
  } else {
    await expect(page.getByPlaceholder("Napiš odpověď")).toHaveValue(FILL_VALUE);
  }
}

test.describe("Focus Test Mode — persistence", () => {
  test("answers survive navigating between questions", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );
    const items = page.getByTestId("question-nav-item");
    test.skip(
      (await items.count()) < 2,
      "Skipped because the test has fewer than 2 questions to navigate between.",
    );

    const target = await firstUnansweredIndex(page);
    test.skip(
      target === -1,
      "Skipped because the active local resumed attempt is already fully answered.",
    );

    const kind = await test.step("answer a still-unanswered question", async () => {
      await items.nth(target).click();
      const k = await answerAndDetect(page);
      if (k) await expectSaved(page);
      return k;
    });
    test.skip(!kind, "Skipped because the targeted question has no answer control.");

    await test.step("navigate away and back — the value is intact", async () => {
      const other = target === 0 ? 1 : 0;
      await items.nth(other).click();
      await expect(page.getByTestId("question-card")).toBeVisible();
      await items.nth(target).click();
      await expectAnswerPresent(page, kind!);
      await expect(items.nth(target)).toHaveAttribute("data-answered", "true");
    });
  });

  test("answers survive a full page reload (resume)", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );
    const items = page.getByTestId("question-nav-item");

    const target = await firstUnansweredIndex(page);
    test.skip(
      target === -1,
      "Skipped because the active local resumed attempt is already fully answered.",
    );

    const kind = await test.step("answer and confirm server-persisted", async () => {
      await items.nth(target).click();
      const k = await answerAndDetect(page);
      if (k) await expectSaved(page); // must be server-persisted before reload
      return k;
    });
    test.skip(!kind, "Skipped because the targeted question has no answer control.");

    await test.step("reload resumes the session with the answer restored", async () => {
      await page.reload({ waitUntil: "commit" });
      await expect(page.getByTestId("focus-test-root")).toBeVisible({
        timeout: 15_000,
      });
      await page.getByTestId("question-nav-item").nth(target).click();
      await expectAnswerPresent(page, kind!);
      await expect(
        page.getByTestId("question-nav-item").nth(target),
      ).toHaveAttribute("data-answered", "true");
    });
  });
});
