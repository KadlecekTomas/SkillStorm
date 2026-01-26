import { test, expect } from "@playwright/test";
import { loginAs, resetTestingState, waitForProfile } from "./utils";
import { recordPolicyCheck } from "../../fe-policy/fePolicyScore";

test.beforeEach(async ({ page }) => {
  await resetTestingState(page);
});

test("teacher can access create test CTA", async ({ page }) => {
  await loginAs(page, "teacher@atlas.test");
  await page.goto("/tests");
  await waitForProfile(page);
  const createButton = page.getByRole("button", { name: /Create test/i });
  await expect(createButton).toBeVisible();
  await createButton.click();
  await expect(page).toHaveURL(/\/tests\/create/);
  recordPolicyCheck("RBAC", "teacher-create-test", true, "Teacher sees create test CTA.");
});

test("student lacks teacher-only actions", async ({ page }) => {
  await loginAs(page, "student@atlas.test");
  await page.goto("/tests");
  await waitForProfile(page);
  await expect(page.getByText("Create test")).toHaveCount(0);
  await page.goto("/dashboard/settings");
  await waitForProfile(page);
  await expect(page.getByText("Manage teachers")).toHaveCount(0);
  recordPolicyCheck("RBAC", "student-no-manage", true, "Student cannot see create or manage teachers actions.");
});

test("director sees Manage teachers card", async ({ page }) => {
  await loginAs(page, "director@atlas.test");
  await page.goto("/dashboard/settings");
  await waitForProfile(page);
  await expect(page.getByText("Manage teachers")).toBeVisible();
  recordPolicyCheck("RBAC", "director-manage-teachers", true, "Director can manage teachers.");
});

test("owner has full privileges", async ({ page }) => {
  await loginAs(page, "owner@multiorg.test");
  await page.goto("/tests");
  await waitForProfile(page);
  await expect(page.getByRole("button", { name: /Create test/i })).toBeVisible();
  await page.goto("/dashboard/settings");
  await waitForProfile(page);
  await expect(page.getByText("Manage teachers")).toBeVisible();
  recordPolicyCheck("RBAC", "owner-all-actions", true, "Owner sees teacher and director actions.");
});
