import { test, expect } from "@playwright/test";
import {
  loginAs,
  USERS,
  collectConsoleErrors,
  navigateTo,
  expectAllNavItems,
} from "./helpers";

test.describe("OWNER – full privilege role", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAs(page, USERS.owner);
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

    test("dashboard shows DirectorDashboard (director/owner view)", async ({ page }) => {
      await navigateTo(page, "/app");
      // Owner sees the director/owner dashboard — no "Přehled není k dispozici"
      await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEST MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("test management", () => {
    test("create test CTA is visible on /app/tests", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Vytvořit test")).toBeVisible();
    });

    test("can navigate to /app/tests/create", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await page.getByText("Vytvořit test").first().click();
      await expect(page).toHaveURL(/\/app\/tests\/create/);
    });

    test("heading shows org-wide view (Testy v organizaci)", async ({ page }) => {
      await navigateTo(page, "/app/tests");
      await expect(page.getByText("Testy v organizaci")).toBeVisible();
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

    test("can navigate to teacher manager page", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await page.getByRole("link", { name: "Open teacher manager" }).click();
      await expect(page).toHaveURL(/\/app\/settings\/teachers/);
    });

    test("teacher manager page loads without error", async ({ page }) => {
      await navigateTo(page, "/app/settings/teachers");
      await expect(page.getByText("Teachers")).toBeVisible();
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
  });
});
