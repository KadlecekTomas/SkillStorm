/**
 * E2E: Join flow + Auth Intent Layer (no dependency on redirect query param).
 *
 * 1) /join?token=XYZ unauth → login (no redirect param) → back to join via intent.
 * 2) /join?token=XYZ → login → click Register → register → land on /join via intent.
 * 3) RETURN_TO intent: after login user is redirected to stored path (401 recovery).
 * 4) Multi-org: user with org opens /join?token=YYY → stay on join → accept → /app.
 *
 * Requires: running app + backend. Optional env:
 * - E2E_JOIN_EMAIL / E2E_JOIN_PASSWORD, E2E_JOIN_TOKEN, E2E_REGISTER_EMAIL
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const JOIN_EMAIL = process.env.E2E_JOIN_EMAIL;
const JOIN_PASSWORD = process.env.E2E_JOIN_PASSWORD || "Password123!";
const JOIN_TOKEN = process.env.E2E_JOIN_TOKEN || "e2e-join-token";
const REGISTER_EMAIL = process.env.E2E_REGISTER_EMAIL || `e2e-join-${Date.now()}@skillstorm.local`;

async function loginAtLoginPage(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@|email|e-mail/i).fill(email);
  await page.getByPlaceholder(/••••••••|password|heslo/i).fill(password);
  await page.getByRole("button", { name: /Přihlásit se|Sign in/i }).click();
}

test.describe("Join flow – auth intent (no redirect param)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.context().addInitScript(() => {
      window.sessionStorage.removeItem("skillstorm_auth_intent");
    });
  });

  test("unauthenticated /join with token redirects to login then back to join after login (intent only)", async ({
    page,
  }) => {
    const joinUrl = `/join?token=${encodeURIComponent(JOIN_TOKEN)}`;
    await page.goto(`${BASE_URL}${joinUrl}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    const loginUrl = new URL(page.url());
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("redirect")).toBeFalsy();

    test.skip(!JOIN_EMAIL, "E2E_JOIN_EMAIL not set – skipping login step");
    await loginAtLoginPage(page, JOIN_EMAIL!, JOIN_PASSWORD);
    await page.waitForURL(/\/(join|app)/, { timeout: 15000 });
    const afterLogin = new URL(page.url());
    expect(afterLogin.pathname).toBe("/join");
    expect(afterLogin.searchParams.get("token")).toBe(JOIN_TOKEN);
  });

  test("from /join to login then Register: after register lands on join via intent (no redirect param)", async ({
    page,
  }) => {
    const joinUrl = `${BASE_URL}/join?token=${encodeURIComponent(JOIN_TOKEN)}`;
    await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("link", { name: /Create or join|založit účet|registr/i }).first().click();
    await page.waitForURL(/\/register/, { timeout: 5000 });
    const registerUrl = new URL(page.url());
    expect(registerUrl.searchParams.get("redirect")).toBeFalsy();

    await page.getByPlaceholder(/you@|email|e-mail/i).fill(REGISTER_EMAIL);
    await page.getByPlaceholder(/••••••••|password|heslo/i).fill(JOIN_PASSWORD);
    await page.getByLabel(/jméno|name/i).fill("E2E Join User");
    await page.getByRole("button", { name: /Vytvořit účet|Create/i }).click();
    await page.waitForURL(/\/(join|app|onboarding)/, { timeout: 20000 });
    const afterRegister = new URL(page.url());
    expect(afterRegister.pathname).toBe("/join");
    expect(afterRegister.searchParams.get("token")).toBe(JOIN_TOKEN);
  });

  test("RETURN_TO intent: after login user is redirected to stored path (401 recovery)", async ({
    page,
  }) => {
    test.skip(!JOIN_EMAIL, "E2E_JOIN_EMAIL not set");
    const returnPath = `/join?token=${encodeURIComponent(JOIN_TOKEN)}`;
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((path) => {
      window.sessionStorage.setItem(
        "skillstorm_auth_intent",
        JSON.stringify({ type: "RETURN_TO", path }),
      );
    }, returnPath);
    await loginAtLoginPage(page, JOIN_EMAIL!, JOIN_PASSWORD);
    await page.waitForURL(/\/(join|app)/, { timeout: 15000 });
    const afterLogin = new URL(page.url());
    expect(afterLogin.pathname).toBe("/join");
    expect(afterLogin.searchParams.get("token")).toBe(JOIN_TOKEN);
  });

  test("multi-org: user with org can open /join with token and stay on join (no redirect to /app)", async ({
    page,
  }) => {
    test.skip(!JOIN_EMAIL, "E2E_JOIN_EMAIL not set");
    await loginAtLoginPage(page, JOIN_EMAIL!, JOIN_PASSWORD);
    await page.waitForURL(/\/(app|dashboard)/, { timeout: 15000 });
    const joinUrl = `${BASE_URL}/join?token=${encodeURIComponent(JOIN_TOKEN)}`;
    await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/(join|app)/, { timeout: 10000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/join");
    expect(url.searchParams.get("token")).toBe(JOIN_TOKEN);
  });
});
