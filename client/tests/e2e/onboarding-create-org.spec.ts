/**
 * ONBOARDING INVARIANT – E2E lock for create-organization flow.
 *
 * Prevents regression where after creating an org the user is thrown back to
 * /onboarding/create-organization or context.mode stays "personal".
 *
 * Requires: running app + backend, and a user WITHOUT organization.
 * Set E2E_ONBOARDING_EMAIL / E2E_ONBOARDING_PASSWORD (e.g. a user registered
 * with INDIVIDUAL mode or created by seed with no memberships).
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ONBOARDING_EMAIL = process.env.E2E_ONBOARDING_EMAIL || "onboarding@skillstorm.local";
const ONBOARDING_PASSWORD = process.env.E2E_ONBOARDING_PASSWORD || "Password123!";

const LOGIN_PATH = "/login";
const CREATE_ORG_PATH = "/onboarding/create-organization";
const PENDING_PATH = "/onboarding/pending";
const ACADEMIC_YEAR_PATH = "/onboarding/academic-year";

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(`${BASE_URL}${LOGIN_PATH}`);
  await page.getByPlaceholder(/you@|email|e-mail/i).fill(email);
  await page.getByPlaceholder(/••••••••|password|heslo/i).fill(password);
  await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

function pathname(page: import("@playwright/test").Page): string {
  return new URL(page.url()).pathname;
}

test.describe("Onboarding create-org invariant (routing + context.mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("after creating org: URL leaves create-organization, survives reload, context.mode is organization", async ({
    page,
  }) => {
    test.skip(
      !ONBOARDING_EMAIL || !ONBOARDING_PASSWORD,
      "E2E_ONBOARDING_EMAIL and E2E_ONBOARDING_PASSWORD must be set (user without org)",
    );
    await loginAs(page, ONBOARDING_EMAIL, ONBOARDING_PASSWORD);

    await page.goto(`${BASE_URL}${CREATE_ORG_PATH}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const orgName = `E2E School ${Date.now()}`;
    await page.getByLabel(/název organizace|organization name/i).fill(orgName);
    await page.getByRole("button", { name: /Vytvořit organizaci/i }).click();

    await page.waitForURL(
      (url) => {
        const p = new URL(url).pathname;
        return p === PENDING_PATH || p === ACADEMIC_YEAR_PATH;
      },
      { timeout: 20000 },
    );

    expect(pathname(page)).not.toContain("create-organization");
    expect(
      pathname(page) === PENDING_PATH || pathname(page) === ACADEMIC_YEAR_PATH,
    ).toBe(true);

    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    expect(pathname(page)).not.toContain("create-organization");

    const meEnvelope = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      return res.json();
    });

    const data = (meEnvelope as { success?: boolean; data?: { context?: { mode?: string } } })
      ?.data;
    expect(data?.context?.mode).toBe("organization");
  });
});
