import { test, expect } from "@playwright/test";

const routes = [
  "/dashboard",
  "/dashboard/classrooms",
  "/dashboard/tests",
  "/dashboard/library",
  "/dashboard/results",
  "/dashboard/settings",
];

for (const path of routes) {
  test(`renders ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.locator('h1, h2, [role="heading"]').first(),
    ).toBeVisible();
  });
}
