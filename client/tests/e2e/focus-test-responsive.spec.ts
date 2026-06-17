import { test, expect, type Page } from "@playwright/test";
import { openFocusTest, MOBILE_VIEWPORT, TABLET_VIEWPORT } from "./helpers/focus";

/**
 * Focus Test Mode — responsive smoke.
 *
 * Verifies the test is actually usable on small screens (not just that the page loads): the
 * sticky status bar fits, the question is readable, an answer can be selected, navigation is
 * reachable, and there is no horizontal overflow.
 */

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  // Allow a 2px sub-pixel/scrollbar tolerance.
  expect(overflow, "page overflows horizontally").toBeLessThanOrEqual(2);
}

test.describe("Focus Test Mode — mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("is usable on a phone-sized viewport", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    // Status bar + question fit and render.
    await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
    await expect(page.getByTestId("question-position")).toBeVisible();
    await expect(page.getByTestId("question-card")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // An answer control is reachable and selectable.
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

    // Primary navigation is reachable without horizontal scrolling.
    await expect(page.getByRole("button", { name: /Další/i })).toBeVisible();
    await expect(page.getByTestId("skip-question")).toBeVisible();

    // The navigator is compactly hidden behind the question-map sheet on mobile.
    await page.getByRole("button", { name: /Mapa otázek/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("question-nav-item").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Focus Test Mode — tablet", () => {
  test.use({ viewport: TABLET_VIEWPORT });

  test("renders without overflow on a tablet viewport", async ({ page }) => {
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");

    await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
    await expect(page.getByTestId("question-card")).toBeVisible();
    await expect(page.getByTestId("submit-test")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
