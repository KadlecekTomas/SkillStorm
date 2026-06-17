import { test, expect, type Page } from "@playwright/test";
import {
  openFocusTest,
  answerCurrent,
  firstUnansweredIndex,
  expectSaved,
} from "./helpers/focus";

/**
 * Focus Test Mode — main student journey (non-destructive).
 *
 * Walks the critical answering path with an assertion after every meaningful step. Every
 * assertion tolerates a resumed attempt that may already carry answers; the destructive submit
 * is opt-in. Tests are split by concern rather than bundled into one mega-flow.
 */

async function answeredCountFromNav(page: Page): Promise<number> {
  const items = page.getByTestId("question-nav-item");
  const total = await items.count();
  let answered = 0;
  for (let i = 0; i < total; i++) {
    if ((await items.nth(i).getAttribute("data-answered")) === "true") answered++;
  }
  return answered;
}

async function readPercent(page: Page): Promise<number> {
  const text = (await page.getByTestId("progress-percent").textContent()) ?? "";
  return Number(text.replace(/[^\d]/g, ""));
}

test.describe("Focus Test Mode — student journey", () => {
  test("renders a distraction-free shell with orientation controls", async ({
    page,
  }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    // No dashboard chrome leaks in.
    await expect(page.locator('a[href="/app/classrooms"]')).toHaveCount(0);
    await expect(page.locator('a[href="/app/tests"]')).toHaveCount(0);

    // Orientation controls are present.
    await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
    await expect(page.getByTestId("question-position")).toHaveText(
      /Otázka\s+\d+\s+z\s+\d+/,
    );
    await expect(page.getByTestId("progress-percent")).toHaveText(/%/);
    await expect(page.getByTestId("question-navigator").first()).toBeVisible();
    await expect(page.getByTestId("question-card")).toBeVisible();
    await expect(page.getByTestId("submit-test")).toBeVisible();

    // Exactly one question is marked current for assistive tech.
    await expect(page.locator('[data-testid="question-nav-item"][aria-current="true"]')).toHaveCount(1);
  });

  test("answering a question reflects in the navigator and keeps progress consistent", async ({
    page,
  }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    const target = await firstUnansweredIndex(page);
    test.skip(target === -1, "Resumed attempt is fully answered — nothing to add.");

    const items = page.getByTestId("question-nav-item");
    await items.nth(target).click();
    await expect(page.getByTestId("question-card")).toBeVisible();

    const kind = await answerCurrent(page, "odpoved-journey");
    test.skip(!kind, "Targeted question exposed no answerable control.");
    await expectSaved(page);

    // The navigator dot flips to answered…
    await expect(items.nth(target)).toHaveAttribute("data-answered", "true");
    // …and the percentage equals answered/total (progress matches the real count).
    const answered = await answeredCountFromNav(page);
    const total = await items.count();
    expect(await readPercent(page)).toBe(Math.round((answered / total) * 100));
  });

  test("covers each available answer control type", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    const items = page.getByTestId("question-nav-item");
    const total = await items.count();
    const present = new Set<string>();
    const answered = new Set<string>();

    // Detect which control types the seed exposes, and demonstrate answering AT MOST ONE of
    // each kind on a currently-unanswered question (minimal mutation keeps the shared attempt
    // usable for the persistence/skip specs).
    for (let i = 0; i < total && answered.size < 2; i++) {
      await items.nth(i).click();
      await expect(page.getByTestId("question-card")).toBeVisible();
      const hasOption = await page
        .getByTestId("answer-option")
        .first()
        .isVisible()
        .catch(() => false);
      const hasFill = await page
        .getByPlaceholder("Napiš odpověď")
        .isVisible()
        .catch(() => false);
      const kind = hasOption ? "option" : hasFill ? "fill" : null;
      if (kind) present.add(kind);
      const isUnanswered =
        (await items.nth(i).getAttribute("data-answered")) === "false";
      if (kind && isUnanswered && !answered.has(kind)) {
        await answerCurrent(page, `odpoved-${i}`);
        await expect(items.nth(i)).toHaveAttribute("data-answered", "true");
        answered.add(kind);
      }
    }
    // The seed should expose at least one control type; both is ideal but not required.
    expect(present.size, "no answerable control types found").toBeGreaterThan(0);
  });

  test("skip jumps to the next unanswered question, or is disabled when none remain", async ({
    page,
  }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    const skip = page.getByTestId("skip-question");
    await expect(skip).toBeVisible();

    if (await skip.isDisabled()) {
      // Correct behaviour when every question is already answered.
      expect(await firstUnansweredIndex(page)).toBe(-1);
      return;
    }

    await skip.click();
    // Landed on a question that is itself not yet answered.
    const currentDot = page.locator(
      '[data-testid="question-nav-item"][aria-current="true"]',
    );
    await expect(currentDot).toHaveAttribute("data-answered", "false");
  });

  test("mark-for-review toggles and survives navigation", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");
    const items = page.getByTestId("question-nav-item");
    test.skip((await items.count()) < 2, "Need at least 2 questions.");

    // Flag question 1.
    await items.nth(0).click();
    const flag = page.getByTestId("flag-question");
    if ((await items.nth(0).getAttribute("data-flagged")) === "true") {
      await flag.click(); // normalise to unflagged first
    }
    await flag.click();
    await expect(items.nth(0)).toHaveAttribute("data-flagged", "true");
    await expect(page.getByTestId("flagged-count")).toBeVisible();

    // Navigate away and back — the flag persists.
    await items.nth(1).click();
    await items.nth(0).click();
    await expect(items.nth(0)).toHaveAttribute("data-flagged", "true");

    // Unflag → state clears.
    await flag.click();
    await expect(items.nth(0)).toHaveAttribute("data-flagged", "false");
  });

  test("review dialog summarises the attempt without submitting", async ({
    page,
  }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toBeVisible();
    // A confirm action exists and is actionable online (we do not click it here).
    await expect(page.getByTestId("confirm-submit")).toBeEnabled();
    await page.getByRole("button", { name: /zpět do testu/i }).click();
    await expect(page.getByTestId("review-submit-dialog")).toBeHidden();
  });

  test("submits once and prevents a double submit", async ({ page }) => {
    test.skip(
      process.env.FOCUS_ALLOW_SUBMIT !== "1",
      "Requires isolated destructive submit seed (opt-in via FOCUS_ALLOW_SUBMIT=1).",
    );
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    await answerCurrent(page);
    await expectSaved(page);
    await page.getByTestId("submit-test").click();
    const confirm = page.getByTestId("confirm-submit");
    await confirm.click();
    await expect(confirm).toBeDisabled(); // locked during submit → no double submit
    await expect(page).toHaveURL(/\/app\/results\//, { timeout: 15_000 });
  });
});
