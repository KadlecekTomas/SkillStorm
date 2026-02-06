/**
 * ROUTING LOCK – E2E tests for dashboard routing & auth (ROUTING-AUDIT.md).
 *
 * These tests lock the routing contract. Any change that breaks the contract must fail in CI.
 * They do NOT serve refactoring; they protect the architecture.
 *
 * Requires: running app + backend with seeded users:
 * - Regular: E2E_REGULAR_EMAIL / E2E_REGULAR_PASSWORD (default director@skillstorm.local / Password123!)
 * - Superadmin: E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD (default admin@skillstorm.local / ChangeMeImmediately!)
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const REGULAR_EMAIL = process.env.E2E_REGULAR_EMAIL || "director@skillstorm.local";
const REGULAR_PASSWORD = process.env.E2E_REGULAR_PASSWORD || "Password123!";
const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL || "admin@skillstorm.local";
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD || "ChangeMeImmediately!";

const DASHBOARD = "/dashboard";
const DASHBOARD_PLATFORM = "/dashboard/platform";
const DASHBOARD_PLATFORM_ORGS = "/dashboard/platform/organizations";
const LOGIN_PATH = "/login";

/** Login via UI and wait until we're in dashboard area (or onboarding). */
async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(`${BASE_URL}${LOGIN_PATH}`);
  await page.getByPlaceholder(/you@|email/i).fill(email);
  await page.getByPlaceholder(/••••••••|password/i).fill(password);
  await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Ensure no auth cookie so middleware treats user as unauthenticated. */
async function clearAuthCookie(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
}

function pathname(page: import("@playwright/test").Page): string {
  return new URL(page.url()).pathname;
}

test.describe("1️⃣ Unauthenticated user (ROUTING-AUDIT)", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthCookie(page);
  });

  test("direct /dashboard → redirect to /login?from=...", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD}`, {
      waitUntil: "commit",
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/login\?from=/);
    expect(page.url()).toContain("from=%2Fdashboard");
  });

  test("direct /dashboard/platform → redirect to /login?from=...", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, {
      waitUntil: "commit",
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/login\?from=/);
    expect(page.url()).toContain("from=%2Fdashboard%2Fplatform");
  });

  test("direct /dashboard/platform/organizations → redirect to /login?from=...", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM_ORGS}`, {
      waitUntil: "commit",
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/login\?from=/);
    expect(page.url()).toContain("from=%2Fdashboard%2Fplatform%2Forganizations");
  });
});

test.describe("2️⃣ Regular authenticated user – no platform access (ROUTING-AUDIT)", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthCookie(page);
    await loginAs(page, REGULAR_EMAIL, REGULAR_PASSWORD);
  });

  test("/dashboard → stays on /dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD);
  });

  test("/dashboard/platform → redirect to /dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD);
  });

  test("/dashboard/platform/organizations → redirect to /dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM_ORGS}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD);
  });
});

test.describe("3️⃣ SUPERADMIN / platform admin (ROUTING-AUDIT)", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthCookie(page);
    await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  });

  test("/dashboard → stays on /dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD);
  });

  test("/dashboard/platform → redirect to /dashboard/platform/organizations", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD_PLATFORM_ORGS);
  });

  test("/dashboard/platform/organizations → stays", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM_ORGS}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD_PLATFORM_ORGS);
  });

  test("logout never crashes and never shows error boundary", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM_ORGS}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.getByRole("button", { name: "Odhlásit se" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  });

  test("refresh on /dashboard/platform/organizations does not redirect or loop", async ({ page }) => {
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM_ORGS}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    expect(pathname(page)).toBe(DASHBOARD_PLATFORM_ORGS);

    // Capture navigations to detect loops
    let navigationCount = 0;
    page.on("framenavigated", () => {
      navigationCount++;
    });

    // Hard refresh – must not get stuck on "Kontroluji oprávnění"
    await page.reload({ waitUntil: "networkidle", timeout: 20000 });

    // URL must stay on platform organizations
    expect(pathname(page)).toBe(DASHBOARD_PLATFORM_ORGS);

    // Auth invariant: spinner must disappear (no infinite loading)
    await expect(page.locator("text=Kontroluji oprávnění")).not.toBeVisible({ timeout: 15000 });

    // Hydration marker – table or empty state should appear
    const tableSelector = "table";
    await expect(page.locator(tableSelector).first()).toBeVisible({ timeout: 15000 });

    // There may be a couple of internal navigations, but no infinite loop
    expect(navigationCount).toBeLessThanOrEqual(4);
  });
});

test.describe("4️⃣ Redirect loop guard (ROUTING-AUDIT)", () => {
  test("unauthenticated: single redirect to login (no loop)", async ({ page }) => {
    await clearAuthCookie(page);
    let redirectCount = 0;
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 300 && status < 400) redirectCount++;
    });
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, { waitUntil: "load", timeout: 10000 });
    await expect(page).toHaveURL(/\/login\?from=/);
    expect(redirectCount).toBeLessThanOrEqual(2);
  });

  test("regular user: at most one client redirect from platform to dashboard", async ({ page }) => {
    await clearAuthCookie(page);
    await loginAs(page, REGULAR_EMAIL, REGULAR_PASSWORD);
    let navigationCount = 0;
    page.on("framenavigated", () => navigationCount++);
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD);
    expect(navigationCount).toBeLessThanOrEqual(3);
  });

  test("superadmin: at most one client redirect from /dashboard/platform to organizations", async ({ page }) => {
    await clearAuthCookie(page);
    await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    let navigationCount = 0;
    page.on("framenavigated", () => navigationCount++);
    await page.goto(`${BASE_URL}${DASHBOARD_PLATFORM}`, { waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).toBe(DASHBOARD_PLATFORM_ORGS);
    expect(navigationCount).toBeLessThanOrEqual(3);
  });
});
