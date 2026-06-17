import {
  test,
  expect,
  type Page,
  openFocusTest,
  answerCurrent,
  firstUnansweredIndex,
  expectSaved,
  expectFocusChromeHidden,
  expectReviewDialogOpen,
} from "./helpers/focus";

/**
 * Focus Test Mode — main student journey (non-destructive).
 *
 * Walks the critical answering path with an assertion after every meaningful step. Steps make
 * the failing phase obvious and diagnostics attach the UI state on failure. Every assertion
 * tolerates a resumed attempt that may already carry answers; the destructive submit is opt-in.
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
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("focus shell has no dashboard chrome", () =>
      expectFocusChromeHidden(page));

    await test.step("orientation controls are present", async () => {
      await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
      await expect(page.getByTestId("question-position")).toHaveText(
        /Otázka\s+\d+\s+z\s+\d+/,
      );
      await expect(page.getByTestId("progress-percent")).toHaveText(/%/);
      await expect(page.getByTestId("question-navigator").first()).toBeVisible();
      await expect(page.getByTestId("question-card")).toBeVisible();
      await expect(page.getByTestId("submit-test")).toBeVisible();
    });

    await test.step("exactly one question is marked current for a11y", async () => {
      await expect(
        page.locator('[data-testid="question-nav-item"][aria-current="true"]'),
      ).toHaveCount(1);
    });
  });

  test("answering a question reflects in the navigator and keeps progress consistent", async ({
    page,
  }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    const target = await firstUnansweredIndex(page);
    test.skip(
      target === -1,
      "Skipped because the active local resumed attempt is already fully answered.",
    );

    const items = page.getByTestId("question-nav-item");
    const kind = await test.step("answer a still-unanswered question", async () => {
      await items.nth(target).click();
      await expect(page.getByTestId("question-card")).toBeVisible();
      const k = await answerCurrent(page, "odpoved-journey");
      if (k) await expectSaved(page);
      return k;
    });
    test.skip(!kind, "Skipped because the targeted question has no answer control.");

    await test.step("navigator dot flips to answered", () =>
      expect(items.nth(target)).toHaveAttribute("data-answered", "true"));

    await test.step("progress percentage equals answered/total", async () => {
      const answered = await answeredCountFromNav(page);
      const total = await items.count();
      expect(await readPercent(page)).toBe(
        Math.round((answered / total) * 100),
      );
    });
  });

  test("covers each available answer control type", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    const items = page.getByTestId("question-nav-item");
    const total = await items.count();
    const present = new Set<string>();
    const answered = new Set<string>();

    // Detect which control types the seed exposes, and demonstrate answering AT MOST ONE of
    // each kind on a currently-unanswered question (minimal mutation keeps the shared attempt
    // usable for the persistence/skip specs).
    await test.step("survey questions and answer one of each control type", async () => {
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
    });

    await test.step("at least one answerable control type is present", () => {
      expect(present.size, "no answerable control types found").toBeGreaterThan(
        0,
      );
    });
  });

  test("skip jumps to the next unanswered question, or is disabled when none remain", async ({
    page,
  }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    const skip = page.getByTestId("skip-question");
    await expect(skip).toBeVisible();

    if (await skip.isDisabled()) {
      await test.step("skip is disabled because everything is answered", async () => {
        expect(await firstUnansweredIndex(page)).toBe(-1);
      });
      return;
    }

    await test.step("skip lands on a not-yet-answered question", async () => {
      await skip.click();
      const currentDot = page.locator(
        '[data-testid="question-nav-item"][aria-current="true"]',
      );
      await expect(currentDot).toHaveAttribute("data-answered", "false");
    });
  });

  test("mark-for-review toggles and survives navigation", async ({ page }) => {
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

    const flag = page.getByTestId("flag-question");
    await test.step("flag question 1", async () => {
      await items.nth(0).click();
      if ((await items.nth(0).getAttribute("data-flagged")) === "true") {
        await flag.click(); // normalise to unflagged first
      }
      await flag.click();
      await expect(items.nth(0)).toHaveAttribute("data-flagged", "true");
      await expect(page.getByTestId("flagged-count")).toBeVisible();
    });

    await test.step("flag survives navigating away and back", async () => {
      await items.nth(1).click();
      await items.nth(0).click();
      await expect(items.nth(0)).toHaveAttribute("data-flagged", "true");
    });

    await test.step("unflag clears the state", async () => {
      await flag.click();
      await expect(items.nth(0)).toHaveAttribute("data-flagged", "false");
    });
  });

  test("review dialog summarises the attempt without submitting", async ({
    page,
  }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("open the review dialog", async () => {
      await page.getByTestId("submit-test").click();
      await expectReviewDialogOpen(page);
    });
    await test.step("a confirm action is available online (not clicked)", () =>
      expect(page.getByTestId("confirm-submit")).toBeEnabled());
    await test.step("return to the test without submitting", async () => {
      await page.getByRole("button", { name: /zpět do testu/i }).click();
      await expect(page.getByTestId("review-submit-dialog")).toBeHidden();
    });
  });

  test("submits once and prevents a double submit", async ({ page }) => {
    test.skip(
      process.env.FOCUS_ALLOW_SUBMIT !== "1",
      "Requires isolated destructive submit seed; disabled unless FOCUS_ALLOW_SUBMIT=1.",
    );
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("answer and confirm saved", async () => {
      await answerCurrent(page);
      await expectSaved(page);
    });
    await test.step("submit once; confirm locks to prevent a double submit", async () => {
      await page.getByTestId("submit-test").click();
      const confirm = page.getByTestId("confirm-submit");
      await confirm.click();
      await expect(confirm).toBeDisabled();
      await expect(page).toHaveURL(/\/app\/results\//, { timeout: 15_000 });
    });
  });
});
