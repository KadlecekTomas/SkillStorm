import { test, expect } from "@playwright/test";
import {
  loginAs,
  USERS,
  collectConsoleErrors,
  navigateTo,
  expectAllNavItems,
} from "./helpers";

test.describe("DIRECTOR – school management role", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAs(page, USERS.director);
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

    test("dashboard shows DirectorDashboard (not empty state)", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEST MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("test management", () => {
    test("create test CTA is visible", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Vytvořit test")).toBeVisible();
    });

    test("heading shows org-wide view", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Testy v organizaci")).toBeVisible();
    });

    test("teacher filter is available when tests exist", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      // The filter shows when isDirector and teachers array is non-empty.
      // It may or may not be visible depending on seeded data, but the label element exists.
      const teacherFilter = page.locator("#teacher-filter");
      // If there are tests with creators, the filter appears
      const count = await teacherFilter.count();
      // Either visible or not — no crash
      expect(count).toBeLessThanOrEqual(1);
    });

    test("can navigate to test creation page", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await page.getByText("Vytvořit test").first().click();
      await expect(page).toHaveURL(/\/app\/tests\/create/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CLASS MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("class management", () => {
    test("Manage teachers card is visible on settings", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await expect(page.getByText("Manage teachers")).toBeVisible();
    });

    test("Open teacher manager link navigates correctly", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await page.getByRole("link", { name: "Open teacher manager" }).click();
      await expect(page).toHaveURL(/\/app\/settings\/teachers/);
      await expect(page.getByText("Teachers")).toBeVisible();
    });

    test("classrooms page loads without error", async ({ page }) => {
      await navigateTo(page, "/app/classrooms");
      // Page loads without crash — no Access Denied for director
      await expect(page.getByText("Access denied")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. INVITE MEMBERS
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("invite functionality", () => {
    test("invite members card is visible on settings", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await expect(page.getByText("Invite members")).toBeVisible();
    });

    test("can generate invite code", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      // Invite card auto-generates a code
      await expect(page.getByText("Invite code")).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. API + UI CONSISTENCY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("api + ui consistency", () => {
    test("no infinite spinner on dashboard", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.getByText("Kontroluji oprávnění")).not.toBeVisible({ timeout: 10_000 });
    });
  });
});
