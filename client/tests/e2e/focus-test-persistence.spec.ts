import { test, expect, type Page } from "@playwright/test";
import {
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
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");
    const items = page.getByTestId("question-nav-item");
    const total = await items.count();
    test.skip(total < 2, "Need at least 2 questions.");

    const target = await firstUnansweredIndex(page);
    test.skip(target === -1, "Resumed attempt is fully answered.");

    await items.nth(target).click();
    const kind = await answerAndDetect(page);
    test.skip(!kind, "Targeted question exposed no answerable control.");
    await expectSaved(page);

    // Navigate away (a different question) and back — value must be intact.
    const other = target === 0 ? 1 : 0;
    await items.nth(other).click();
    await expect(page.getByTestId("question-card")).toBeVisible();
    await items.nth(target).click();
    await expectAnswerPresent(page, kind!);
    await expect(items.nth(target)).toHaveAttribute("data-answered", "true");
  });

  test("answers survive a full page reload (resume)", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");
    const items = page.getByTestId("question-nav-item");

    const target = await firstUnansweredIndex(page);
    test.skip(target === -1, "Resumed attempt is fully answered.");

    await items.nth(target).click();
    const kind = await answerAndDetect(page);
    test.skip(!kind, "Targeted question exposed no answerable control.");
    await expectSaved(page); // must be server-persisted before reload

    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("focus-test-root")).toBeVisible({
      timeout: 15_000,
    });
    // The resumed session rehydrates from the backend: the answer is restored.
    await page.getByTestId("question-nav-item").nth(target).click();
    await expectAnswerPresent(page, kind!);
    await expect(
      page.getByTestId("question-nav-item").nth(target),
    ).toHaveAttribute("data-answered", "true");
  });
});
