import { test, expect } from "@playwright/test";
import { getAuditLog, loginAs, resetTestingState, waitForProfile, waitForSubmissionReady } from "./utils";
import { recordPolicyCheck } from "../fePolicyScore";

test.beforeEach(async ({ page }) => {
  await resetTestingState(page);
});

test("student submissions respect attempt limits and audit trails", async ({ page }) => {
  await loginAs(page, "student@atlas.test");

  const loginLog = await getAuditLog(page);
  expect(loginLog.events.some((event: { action: string }) => event.action === "LOGIN")).toBe(true);
  recordPolicyCheck("Audit", "audit-login-event", true, "LOGIN event pushed to audit log.");

  await page.goto("/dashboard/tests/test-algebra-org-a/submission");
  await waitForProfile(page);
  await waitForSubmissionReady(page);
  await page.getByRole("button", { name: "Start attempt" }).click();
  await page.locator('label:has-text("5")').first().click();
  await page.fill('input[placeholder="Zadej číslo"]', "5");
  await page.fill('textarea[placeholder="Tvoje odpověď"]', "trojúhelník");
  await page.getByRole("button", { name: /Odeslat odpovědi/i }).click();
  await expect(page.getByText(/Score 100%/i)).toBeVisible();
  recordPolicyCheck("Submissions", "submission-first-attempt", true, "First attempt completes with score.");

  const afterSubmission = await getAuditLog(page);
  expect(
    afterSubmission.events.some((event: { action: string }) => event.action === "SUBMISSION_FINISH"),
  ).toBe(true);
  recordPolicyCheck("Audit", "audit-submission-finish", true, "Finishing submission produces audit event.");

  await page.getByRole("button", { name: "Start attempt" }).click();
  await page.locator('label:has-text("5")').first().click();
  await page.fill('input[placeholder="Zadej číslo"]', "5");
  await page.fill('textarea[placeholder="Tvoje odpověď"]', "trojúhelník");
  await page.getByRole("button", { name: /Odeslat odpovědi/i }).click();
  await expect(page.getByText(/Score/)).toBeVisible();
  recordPolicyCheck("Submissions", "submission-second-attempt", true, "Second attempt allowed.");

  await page.getByRole("button", { name: "Start attempt" }).click();
  await expect(page.getByText(/Limit pokusů byl vyčerpán/i)).toBeVisible();
  recordPolicyCheck("Submissions", "submission-max-attempts", true, "Third attempt blocked with warning.");
});
