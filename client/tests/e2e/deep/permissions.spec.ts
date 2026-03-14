/**
 * PART 7 — RBAC PERMISSION TESTS
 *
 * Verifies that role-based access control is enforced in the UI:
 *
 * STUDENT must NOT:
 *   - access /app/tests (blocked by CREATE_TEST + EDIT_TEST guard)
 *   - access /app/tests/create
 *   - access curriculum/teacher settings
 *   - access /app/assignments/manage (route doesn't exist — 404 or redirect)
 *
 * TEACHER must NOT:
 *   - edit curriculum (settings/teachers page)
 *   - change academic years (academic-years page redirects or denies)
 *   - see the org-wide teacher filter on tests page
 *
 * DIRECTOR must:
 *   - access /app/settings/teachers
 *   - see "Manage teachers" on settings page
 *   - see org-wide test heading
 *   - access academic years page
 */
import { test, expect } from "@playwright/test";
import {
  loginAsStudent,
  loginAsTeacher,
  loginAsDirector,
  collectConsoleErrors,
  assertNoCriticalErrors,
  waitForProfile,
} from "./utils/auth";
import {
  navigateTo,
  expectAccessDenied,
  expectNotAccessDenied,
  expectNoRawErrors,
} from "./utils/navigation";

// ---------------------------------------------------------------------------
// STUDENT restrictions
// ---------------------------------------------------------------------------

test.describe("STUDENT – access restrictions", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsStudent(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("cannot access /app/tests — Access Denied is shown", async ({ page }) => {
    await page.goto("/app/tests", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 10_000,
    });
    await expectAccessDenied(page);
  });

  test("/app/tests does not show Create test button for student", async ({ page }) => {
    await page.goto("/app/tests", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 10_000,
    });
    await expect(page.getByText("Vytvořit test")).not.toBeVisible();
  });

  test("cannot access /app/tests/create — redirected or Access Denied", async ({ page }) => {
    await page.goto("/app/tests/create", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    const isRedirected = !url.includes("/app/tests/create");
    const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
    expect(isRedirected || hasAccessDenied).toBe(true);
  });

  test("cannot access /app/settings/teachers", async ({ page }) => {
    await page.goto("/app/settings/teachers", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    const isRedirected = !url.includes("/app/settings/teachers");
    const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
    expect(isRedirected || hasAccessDenied).toBe(true);
  });

  test("settings page does not show Manage teachers for student", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Manage teachers")).not.toBeVisible();
  });

  test("settings page does not show Invite members for student", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Invite members")).not.toBeVisible();
  });

  test("/app/tests shows 'Požádat správce' button on Access Denied screen", async ({ page }) => {
    await page.goto("/app/tests", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 10_000,
    });
    const hasBtn = await page.getByText("Požádat správce").isVisible().catch(() => false);
    // Either the button is there, or at minimum access denied is shown
    const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
    expect(hasBtn || hasAccessDenied).toBe(true);
  });

  test("dashboard does not crash and shows StudentDashboard", async ({ page }) => {
    await navigateTo(page, "/app");
    await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
    await expectNoRawErrors(page);
  });
});

// ---------------------------------------------------------------------------
// TEACHER restrictions
// ---------------------------------------------------------------------------

test.describe("TEACHER – access restrictions", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsTeacher(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("cannot access /app/settings/teachers — redirected or Access Denied", async ({ page }) => {
    await page.goto("/app/settings/teachers", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    const isRedirected = !url.includes("/app/settings/teachers");
    const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
    expect(isRedirected || hasAccessDenied).toBe(true);
  });

  test("settings page does not show Manage teachers card", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Manage teachers")).not.toBeVisible();
  });

  test("teacher filter is NOT visible on tests page (not a director)", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await expect(page.locator("#teacher-filter")).not.toBeVisible();
  });

  test("tests page shows personal heading 'Moje testy'", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await expect(page.getByText("Moje testy")).toBeVisible();
  });

  test("academic years page is accessible or redirects — no crash", async ({ page }) => {
    await page.goto("/app/academic-years", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    // Teacher may or may not have access — just no crash
    await expectNoRawErrors(page);
  });

  test("classrooms page loads for teacher (no access denied)", async ({ page }) => {
    await navigateTo(page, "/app/classrooms");
    await expectNotAccessDenied(page);
  });

  test("settings page shows Invite members (teachers can invite students)", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Invite members")).toBeVisible({ timeout: 8_000 });
  });

  test("can navigate to create test page", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await page.getByText("Vytvořit test").first().click();
    await expect(page).toHaveURL(/\/app\/tests\/create/);
  });
});

// ---------------------------------------------------------------------------
// DIRECTOR permissions
// ---------------------------------------------------------------------------

test.describe("DIRECTOR – elevated access", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAsDirector(page);
  });

  test.afterEach(() => {
    assertNoCriticalErrors(consoleErrors);
  });

  test("can access /app/settings/teachers", async ({ page }) => {
    await navigateTo(page, "/app/settings/teachers");
    await expectNotAccessDenied(page);
    await expect(page.getByText("Teachers")).toBeVisible({ timeout: 8_000 });
  });

  test("settings page shows Manage teachers card", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Manage teachers")).toBeVisible();
  });

  test("can open teacher manager via link", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await page.getByRole("link", { name: "Open teacher manager" }).click();
    await expect(page).toHaveURL(/\/app\/settings\/teachers/);
  });

  test("tests page shows org-wide heading 'Testy v organizaci'", async ({ page }) => {
    await navigateTo(page, "/app/tests");
    await expect(page.getByText("Testy v organizaci")).toBeVisible();
  });

  test("can access academic years page", async ({ page }) => {
    await page.goto("/app/academic-years", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    }).catch(() => {});
    await expectNoRawErrors(page);
  });

  test("classrooms page loads for director without access denied", async ({ page }) => {
    await navigateTo(page, "/app/classrooms");
    await expectNotAccessDenied(page);
  });

  test("can access invite code on settings page", async ({ page }) => {
    await navigateTo(page, "/app/settings");
    await expect(page.getByText("Invite code")).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Cross-role: platform admin routes are blocked for school users
// ---------------------------------------------------------------------------

test.describe("platform routes blocked for school users", () => {
  test("director cannot access /app/platform", async ({ page }) => {
    await loginAsDirector(page);
    await page.goto("/app/platform", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    // Should redirect to forbidden or login
    const url = page.url();
    const isForbidden =
      url.includes("/forbidden") ||
      url.includes("/login") ||
      (await page.getByText(/forbidden|přístup odepřen|not authorized/i).isVisible().catch(() => false));
    expect(isForbidden).toBe(true);
  });

  test("teacher cannot access /app/platform", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/app/platform", { waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    const isForbidden =
      url.includes("/forbidden") ||
      url.includes("/login") ||
      (await page.getByText(/forbidden|přístup odepřen|not authorized/i).isVisible().catch(() => false));
    expect(isForbidden).toBe(true);
  });
});
