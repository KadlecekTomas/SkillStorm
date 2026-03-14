/**
 * PART 1 — AUTHENTICATION TESTS
 *
 * Covers:
 * - Correct redirect after login for each role
 * - Dashboard loads and renders the right component
 * - User identity is visible
 * - Logout works and returns to /login
 * - Unauthenticated access is redirected to /login
 */
import { test, expect } from "@playwright/test";
import {
  loginAsDirector,
  loginAsTeacher,
  loginAsStudent,
  logout,
  waitForProfile,
  collectConsoleErrors,
  assertNoCriticalErrors,
} from "./utils/auth";
import { expectNoSpinner, expectNoRawErrors, expectSidebarLoaded } from "./utils/navigation";

// ---------------------------------------------------------------------------
// Unauthenticated redirect
// ---------------------------------------------------------------------------

test.describe("unauthenticated access", () => {
  test("redirects /app to /login when not logged in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("redirects /app/tests to /login when not logged in", async ({ page }) => {
    await page.goto("/app/tests");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Director login
// ---------------------------------------------------------------------------

test.describe("DIRECTOR login", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsDirector(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("lands on /app after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 8_000 });
  });

  test("dashboard renders without spinner or errors", async ({ page }) => {
    await expectNoSpinner(page);
    await expectNoRawErrors(page);
  });

  test("sidebar navigation is present", async ({ page }) => {
    await expectSidebarLoaded(page);
  });

  test("DirectorDashboard renders (not empty state)", async ({ page }) => {
    await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
  });

  test("logout returns to /login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("session is cleared after logout — /app redirects to login", async ({ page }) => {
    await logout(page);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Teacher login
// ---------------------------------------------------------------------------

test.describe("TEACHER login", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsTeacher(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("lands on /app after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 8_000 });
  });

  test("dashboard renders without spinner or errors", async ({ page }) => {
    await expectNoSpinner(page);
    await expectNoRawErrors(page);
  });

  test("sidebar navigation is present", async ({ page }) => {
    await expectSidebarLoaded(page);
  });

  test("TeacherDashboard renders (not empty state)", async ({ page }) => {
    await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
  });

  test("logout returns to /login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Student login
// ---------------------------------------------------------------------------

test.describe("STUDENT login", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsStudent(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("lands on /app after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/app/, { timeout: 8_000 });
  });

  test("dashboard renders without spinner or errors", async ({ page }) => {
    await expectNoSpinner(page);
    await expectNoRawErrors(page);
  });

  test("StudentDashboard renders (not empty state)", async ({ page }) => {
    await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
  });

  test("logout returns to /login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Invalid credentials
// ---------------------------------------------------------------------------

test.describe("invalid credentials", () => {
  test("shows error message on wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/you@school\.edu/i).fill("director@chodovicka.cz");
    await page.getByPlaceholder(/••••••••/i).fill("wrongpassword");
    await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();

    // Should stay on /login
    await expect(page).toHaveURL(/\/login/);

    // Should show an error
    const errorVisible =
      (await page.getByText(/Neplatné|Invalid|incorrect/i).isVisible().catch(() => false)) ||
      (await page.locator('[role="alert"]').isVisible().catch(() => false));
    expect(errorVisible).toBe(true);
  });

  test("shows error on empty submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();

    // Validation fires — stays on /login
    await expect(page).toHaveURL(/\/login/);
  });
});
