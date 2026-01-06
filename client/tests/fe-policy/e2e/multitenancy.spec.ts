import { test, expect } from "@playwright/test";
import { loginAs, resetTestingState, waitForProfile } from "./utils";
import { recordPolicyCheck } from "../fePolicyScore";

test.beforeEach(async ({ page }) => {
  await resetTestingState(page);
});

test("teacher cannot open test from foreign organization", async ({ page }) => {
  await loginAs(page, "teacher@atlas.test");
  await page.goto("/org/org-b/tests/test-history-org-b");
  await waitForProfile(page);
  await expect(page.getByText(/Access denied/i)).toBeVisible();
  recordPolicyCheck("Multitenancy", "deny-cross-org", true, "Teacher cannot access tests outside active org.");
});

test("teacher of org B can view their test", async ({ page }) => {
  await loginAs(page, "teacher@lumen.test");
  await page.goto("/org/org-b/tests/test-history-org-b");
  await waitForProfile(page);
  await expect(page.getByText("World history check")).toBeVisible();
  recordPolicyCheck("Multitenancy", "org-b-access", true, "Teacher of org B can access test resources.");
});
