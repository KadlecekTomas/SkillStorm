import { test, expect } from "@playwright/test";
import { recordPolicyCheck } from "../fePolicyScore";
import { callTestingEndpoint, loginAs, resetTestingState, waitForProfile } from "./utils";

test.beforeEach(async ({ page }) => {
  await resetTestingState(page);
});

test("redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  recordPolicyCheck("Auth", "redirect-unauthenticated", true, "Unauthenticated user is redirected to login.");
});

test("teacher login + silent refresh keeps context", async ({ page }) => {
  await loginAs(page, "teacher@atlas.test");
  recordPolicyCheck("Auth", "teacher-login", true, "Teacher can access dashboard.");

  await page.waitForLoadState("networkidle");
  await callTestingEndpoint(page, "/testing/expire-token");
  await page.goto("/dashboard/tests", { waitUntil: "load" });
  await waitForProfile(page);
  await expect(page).toHaveURL(/dashboard\/tests/);
  await expect(page.getByRole("button", { name: /New test/i })).toBeVisible();
  recordPolicyCheck("Auth", "silent-refresh", true, "Expired token refreshes without logout.");
});

test("logout returns to login screen", async ({ page }) => {
  await loginAs(page, "teacher@atlas.test");
  await Promise.all([
    page.waitForURL(/\/login/),
    page.getByRole("button", { name: "Odhlásit se" }).click(),
  ]);
  recordPolicyCheck("Auth", "logout", true, "Logout redirects to login.");
});
