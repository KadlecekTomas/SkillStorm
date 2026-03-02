import { test, expect } from "@playwright/test";
import {
  loginAs,
  USERS,
  collectConsoleErrors,
  navigateTo,
  expectAllNavItems,
  expectAccessDenied,
} from "./helpers";

test.describe("TEACHER – classroom management role", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAs(page, USERS.teacher);
  });

  test.afterEach(() => {
    const critical = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("ERR_BLOCKED_BY_CLIENT"),
    );
    expect(critical).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD VISIBILITY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("dashboard visibility", () => {
    test("all sidebar navigation items are visible", async ({ page }) => {
      await navigateTo(page, "/app");
      await expectAllNavItems(page);
    });

    test("dashboard shows TeacherDashboard", async ({ page }) => {
      await navigateTo(page, "/app");
      // Teacher sees their dashboard — not the empty state
      await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEST MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("test management", () => {
    test("create test button is visible on tests page", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Vytvořit test")).toBeVisible();
    });

    test("can navigate to create test page", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await page.getByText("Vytvořit test").first().click();
      await expect(page).toHaveURL(/\/app\/tests\/create/);
    });

    test("heading shows personal view (Moje testy)", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Moje testy")).toBeVisible();
    });

    test("teacher filter is NOT visible (not director)", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.locator("#teacher-filter")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CLASS MANAGEMENT — RESTRICTED
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("class management — restricted", () => {
    test("Manage teachers card is NOT visible on settings", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await expect(page.getByText("Manage teachers")).not.toBeVisible();
    });

    test("direct URL to teacher manager redirects or shows access denied", async ({ page }) => {
      await page.goto("/app/settings/teachers", { waitUntil: "commit" });
      // withPermission HOC redirects to role home when permission missing
      // Wait for navigation to settle
      await page.waitForLoadState("networkidle").catch(() => {});
      // Teacher should NOT be on /app/settings/teachers
      const url = page.url();
      const isRedirected = !url.includes("/app/settings/teachers");
      const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
      expect(isRedirected || hasAccessDenied).toBe(true);
    });

    test("classrooms page loads for teacher", async ({ page }) => {
      await navigateTo(page, "/app/classrooms");
      await expect(page.getByText("Access denied")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. INVITE FUNCTIONALITY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("invite functionality", () => {
    test("invite members card is visible (teacher can invite students)", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await expect(page.getByText("Invite members")).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. API + UI CONSISTENCY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("api + ui consistency", () => {
    test("no infinite spinner on tests page", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Kontroluji oprávnění")).not.toBeVisible({ timeout: 10_000 });
    });

    test("no raw JSON errors on dashboard", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.locator("pre")).not.toBeVisible();
    });
  });
});
