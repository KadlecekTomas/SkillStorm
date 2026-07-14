import { test, expect } from "@playwright/test";

test.describe("RBAC routing", () => {
  test("student sees restricted banner on QA checkpoint", async ({ page }) => {
    await page.goto("/qa/rbac-check");
    await expect(
      page.getByText("Omezený přístup", { exact: true }).first(),
    ).toBeVisible();
  });
});
