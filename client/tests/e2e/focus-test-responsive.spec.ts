import {
  test,
  expect,
  openFocusTest,
  expectNoHorizontalOverflow,
  MOBILE_VIEWPORT,
  TABLET_VIEWPORT,
} from "./helpers/focus";

/**
 * Focus Test Mode — responsive smoke.
 *
 * Verifies the test is actually usable on small screens (not just that the page loads): the
 * sticky status bar fits, the question is readable, an answer can be selected, navigation is
 * reachable, and there is no horizontal overflow. Steps make a failing phase obvious.
 */

test.describe("Focus Test Mode — mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("is usable on a phone-sized viewport", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("status bar and question fit and render", async () => {
      await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
      await expect(page.getByTestId("question-position")).toBeVisible();
      await expect(page.getByTestId("question-card")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    await test.step("an answer control is reachable and selectable", async () => {
      const option = page.getByTestId("answer-option").first();
      const fill = page.getByPlaceholder("Napiš odpověď");
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await expect(
          page.locator('[data-testid="answer-option"][data-selected="true"]'),
        ).toHaveCount(1);
      } else if (await fill.isVisible().catch(() => false)) {
        await fill.fill("mobile-answer");
        await expect(fill).toHaveValue("mobile-answer");
      }
    });

    await test.step("primary navigation is reachable without horizontal scroll", async () => {
      await expect(page.getByRole("button", { name: /Další/i })).toBeVisible();
      await expect(page.getByTestId("skip-question")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    await test.step("question map opens as a bottom sheet", async () => {
      await page.getByRole("button", { name: /Mapa otázek/i }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect(sheet.getByTestId("question-nav-item").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});

test.describe("Focus Test Mode — tablet", () => {
  test.use({ viewport: TABLET_VIEWPORT });

  test("renders without overflow on a tablet viewport", async ({ page }) => {
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );

    await test.step("shell renders and does not overflow", async () => {
      await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
      await expect(page.getByTestId("question-card")).toBeVisible();
      await expect(page.getByTestId("submit-test")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});
