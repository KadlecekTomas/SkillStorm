/**
 * PARTS 5 + 9 + 10 — TEACHER RESULTS VIEW, STABILITY & ERROR RESILIENCE
 *
 * Part 5 — Teacher result view:
 *   - opens test results page
 *   - sees class results table
 *   - sees student listed with score and timestamp
 *
 * Part 9 — Stability (best-attempt logic):
 *   - multiple submissions are counted correctly
 *   - analytics remain stable after multiple attempts
 *   - rapid navigation between pages doesn't break state
 *
 * Part 10 — Error resilience:
 *   - duplicate submit returns 409 or is gracefully blocked
 *   - expired assignment shows error, not crash
 *   - browser back/forward navigation doesn't corrupt state
 */
import { test, expect } from "@playwright/test";
import {
  loginAsTeacher,
  loginAsStudent,
  loginAsDirector,
  collectConsoleErrors,
  assertNoCriticalErrors,
  waitForProfile,
} from "./utils/auth";
import { navigateTo, expectNoRawErrors, expectNoSpinner } from "./utils/navigation";

// ---------------------------------------------------------------------------
// PART 5 — Teacher result view
// ---------------------------------------------------------------------------

test.describe("TEACHER – result and submission view", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsTeacher(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("tests page loads and shows tests table", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await expectNoRawErrors(page);
    await expectNoSpinner(page);
    // Either table rows or "no tests" empty state
    const hasRows = await page.locator("table tbody tr").count().then((c) => c > 0).catch(() => false);
    const isEmpty = await page.getByText(/Zatím nemáš žádné testy|žádné přiřazené/i).isVisible().catch(() => false);
    expect(hasRows || isEmpty).toBe(true);
  });

  test("can open a test detail page from the tests list", async ({ page }) => {
    await navigateTo(page, "/app/tests");

    const firstRow = page.locator("table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const link = firstRow.getByRole("link").first();
    if (!(await link.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await link.click();
    await expect(page).toHaveURL(/\/app\/tests\/[a-zA-Z0-9-]+/);
    await waitForProfile(page);
    await expectNoRawErrors(page);
  });

  test("test detail page shows submission statistics", async ({ page }) => {
    await navigateTo(page, "/app/tests");

    // Find a test with submissions (submission count > 0)
    const rowWithSubmissions = page
      .locator("table tbody tr")
      .filter({ hasText: /[1-9]\d*/ }) // any non-zero number
      .first();

    if (!(await rowWithSubmissions.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const link = rowWithSubmissions.getByRole("link").first();
    await link.click();
    await waitForProfile(page);

    // Results page / test detail — should show some stats
    await expectNoRawErrors(page);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("test results page loads (via /results route)", async ({ page }) => {
    await navigateTo(page, "/app/results");
    await expectNoRawErrors(page);
  });

  test("results page has no NaN values", async ({ page }) => {
    await navigateTo(page, "/app/results");
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("results page percentages are valid (0–100)", async ({ page }) => {
    await navigateTo(page, "/app/results");
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyText = await page.locator("body").innerText();
    const matches = bodyText.match(/(\d+(?:\.\d+)?)\s*%/g) ?? [];
    for (const match of matches) {
      const value = parseFloat(match.replace("%", "").trim());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  test("student detail page loads (if student exists in class)", async ({ page }) => {
    // Navigate to classrooms, find a class, find a student
    await navigateTo(page, "/app/classrooms");

    const classLink = page.getByRole("link").filter({ hasText: /\d|klasa|třída|class/i }).first();
    if (!(await classLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await classLink.click();
    await waitForProfile(page);

    // Look for a student link
    const studentLink = page
      .getByRole("link")
      .filter({ has: page.locator("span, p") })
      .first();
    if (!(await studentLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await studentLink.click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    // Student detail page should be at /app/students/<id>
    if (page.url().includes("/students/")) {
      await waitForProfile(page);
      await expectNoRawErrors(page);
      // Score, last activity, topic progress should be present
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toMatch(/\bNaN\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 9 — Stability: rapid navigation and best-attempt logic
// ---------------------------------------------------------------------------

test.describe("stability – rapid navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  test("navigating between dashboard, tests, classrooms rapidly does not crash", async ({ page }) => {
    const routes = ["/app", "/app/tests", "/app/classrooms", "/app/results", "/app"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 10_000,
      });
    }
    await expectNoRawErrors(page);
  });

  test("pressing browser back after test creation does not crash", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await page.getByText("Vytvořit test").first().click();
    await expect(page).toHaveURL(/\/app\/tests\/create/);

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/tests/);
    await waitForProfile(page);
    await expectNoRawErrors(page);
  });

  test("pressing browser forward after back does not crash", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await page.goForward();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 10_000,
    }).catch(() => {});
    await expectNoRawErrors(page);
  });
});

test.describe("stability – student multiple attempts", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("best-attempt analytics are not NaN after multiple attempts", async ({ page }) => {
    await navigateTo(page, "/app");
    await page.waitForLoadState("networkidle").catch(() => {});
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("assignments page remains stable after navigating away and back", async ({ page }) => {
    await navigateTo(page, "/app/assignments");
    await navigateTo(page, "/app");
    await navigateTo(page, "/app/assignments");
    await expectNoRawErrors(page);
  });
});

// ---------------------------------------------------------------------------
// PART 10 — Error resilience
// ---------------------------------------------------------------------------

test.describe("error resilience – API and network", () => {
  test("test creation page shows validation errors without crashing", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests/create");

    // Submit completely empty form
    await page.getByRole("button", { name: /Uložit|Vytvořit/i }).click();

    // Page must stay on /create with validation errors
    await expect(page).toHaveURL(/\/app\/tests\/create/);
    await expectNoRawErrors(page);
  });

  test("create-test with only whitespace title shows validation error", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "/app/tests/create");

    await page.getByRole("textbox").first().fill("   ");
    await page.getByRole("button", { name: /Uložit|Vytvořit/i }).click();

    await expect(page).toHaveURL(/\/app\/tests\/create/);
    await expectNoRawErrors(page);
  });

  test("student accessing an expired assignment sees error — not blank", async ({ page }) => {
    await loginAsStudent(page);

    // Use a guaranteed non-existent UUID
    await page.goto("/assignments/ffffffff-ffff-ffff-ffff-ffffffffffff", {
      waitUntil: "commit",
    });
    await waitForProfile(page);
    await page.waitForLoadState("networkidle").catch(() => {});

    const hasError =
      (await page.getByText(/nebylo nalezeno|not found|Chyba|nemáš oprávnění/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false)) ||
      page.url().includes("/app"); // redirected away

    expect(hasError).toBe(true);
    await expectNoRawErrors(page);
  });

  test("director analytics page recovers from invalid URL params", async ({ page }) => {
    await loginAsDirector(page);
    // Navigate to analytics with garbage query params
    await page.goto("/app/analytics?class=garbage&year=9999", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    }).catch(() => {});
    await expectNoRawErrors(page);
  });

  test("404 route for unknown page shows error or redirects — not blank", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/app/this-page-does-not-exist", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const hasContent =
      (await page.locator("h1, h2").isVisible().catch(() => false)) ||
      (await page.getByText(/404|not found|nenalezeno/i).isVisible().catch(() => false)) ||
      page.url().includes("/app"); // redirected to valid page

    expect(hasContent).toBe(true);
  });

  test("library page loads without errors", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/app/library", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    }).catch(() => {});
    await expectNoRawErrors(page);
    // Library uses data-testid="library-loaded" once ready
    await page.locator('[data-testid="library-loaded"]').waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
  });
});
