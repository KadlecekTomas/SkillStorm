import { test, expect } from "@playwright/test";

test("login flow works", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByPlaceholder(/you@school\.edu/i).fill("student@example.com");
  await page.getByPlaceholder(/password/i).fill("student123");
  await page.getByRole("button", { name: /sign in|přihlášení|přihlásit/i }).click();

  await page.waitForURL(/\/dashboard$/);
  await expect(page.locator("text=Active learners")).toBeVisible();

  const storage = await page.evaluate(() => localStorage.getItem("skillstorm_token"));
  expect(storage).toBeTruthy();
});
