import { test, expect } from "@playwright/test";
import {
  loginAs,
  USERS,
  collectConsoleErrors,
  navigateTo,
  expectAllNavItems,
  expectAccessDenied,
} from "./helpers";

test.describe("STUDENT – read-only consumer role", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await loginAs(page, USERS.student);
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

    test("dashboard shows StudentDashboard", async ({ page }) => {
      await navigateTo(page, "/app");
      // Student sees their own dashboard — not the empty state
      await expect(page.getByText("Přehled není k dispozici")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEST MANAGEMENT — RESTRICTED
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("test management — restricted", () => {
    test("cannot access /app/tests (guarded by CREATE_TEST + EDIT_TEST)", async ({ page }) => {
      await page.goto("/app/tests", { waitUntil: "commit" });
      // withGuard({ requirePerms: [CREATE_TEST, EDIT_TEST] }) blocks student
      await page.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 10_000,
      });
      await expectAccessDenied(page);
    });

    test("cannot see Create test button (Access Denied shown instead)", async ({ page }) => {
      await page.goto("/app/tests", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 10_000,
      });
      await expect(page.getByText("Vytvořit test")).not.toBeVisible();
    });

    test("direct navigation to /app/tests/create shows access denied or redirect", async ({ page }) => {
      await page.goto("/app/tests/create", { waitUntil: "commit" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const url = page.url();
      const isRedirected = !url.includes("/app/tests/create");
      const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
      expect(isRedirected || hasAccessDenied).toBe(true);
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
      await page.waitForLoadState("networkidle").catch(() => {});
      const url = page.url();
      const isRedirected = !url.includes("/app/settings/teachers");
      const hasAccessDenied = await page.getByText("Access denied").isVisible().catch(() => false);
      expect(isRedirected || hasAccessDenied).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. INVITE FUNCTIONALITY — RESTRICTED
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("invite functionality — restricted", () => {
    test("invite members card is NOT visible on settings", async ({ page }) => {
      await navigateTo(page, "/app/settings");
      await expect(page.getByText("Invite members")).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. EMPTY STATE CLARITY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("empty state clarity", () => {
    test("/app/tests shows clear access denied — not blank page", async ({ page }) => {
      await page.goto("/app/tests", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 10_000,
      });
      // Must show an explanation, not just a blank page
      const hasAccessDenied = await page.getByText("Access denied").isVisible();
      const hasRequestButton = await page.getByText("Požádat správce").isVisible().catch(() => false);
      expect(hasAccessDenied).toBe(true);
      expect(hasRequestButton).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. API + UI CONSISTENCY
  // ──────────────────────────────────────────────────────────────────────────

  test.describe("api + ui consistency", () => {
    test("no infinite spinner on dashboard", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.getByText("Kontroluji oprávnění")).not.toBeVisible({ timeout: 10_000 });
    });

    test("no raw JSON or stack trace visible", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.locator("pre")).not.toBeVisible();
    });

    test("error boundary does not trigger on normal navigation", async ({ page }) => {
      await navigateTo(page, "/app");
      await expect(page.getByText("Něco se pokazilo")).not.toBeVisible();
    });
  });
});
