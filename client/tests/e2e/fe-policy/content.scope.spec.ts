import { test, expect } from "@playwright/test";
import { loginAs, resetTestingState, waitForLibraryReady, waitForProfile } from "./utils";
import { recordPolicyCheck } from "../../fe-policy/fePolicyScore";

test.beforeEach(async ({ page }) => {
  await resetTestingState(page);
});

test("materials respect global vs org scope", async ({ page }) => {
  await loginAs(page, "owner@multiorg.test");
  await page.goto("/dashboard/library");
  await waitForProfile(page);
  await waitForLibraryReady(page);
  await expect(page.getByText("Global climate guide")).toBeVisible();
  await expect(page.getByText("Org A STEM syllabus")).toBeVisible();
  await expect(page.getByText("Org B Language kit")).toHaveCount(0);
  recordPolicyCheck("Content", "org-a-scope", true, "Owner in org A sees global + org A materials.");

  await page.getByRole("combobox", { name: "Organizace" }).click();
  await page.getByRole("option", { name: "Lumen Academy" }).click();
  await page.goto("/dashboard/library");
  await waitForLibraryReady(page);
  await waitForProfile(page);
  await expect(page.getByText("Org B Language kit")).toBeVisible();
  await expect(page.getByText("Org A STEM syllabus")).toHaveCount(0);
  recordPolicyCheck("Content", "org-b-scope", true, "Switching org reveals only that org materials.");
});
