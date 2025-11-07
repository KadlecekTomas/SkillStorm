import { test, expect } from "@playwright/test";

test("dashboard visual snapshot", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toHaveScreenshot("dashboard.png", {
    maxDiffPixelRatio: 0.1,
  });
});
