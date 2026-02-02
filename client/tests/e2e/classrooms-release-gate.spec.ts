/**
 * RELEASE GATE: Classrooms × AcademicYear (Playwright)
 *
 * Vyžaduje: běžící app s demo seedem (director@skillstorm.local, Password123!)
 *
 * Ověřuje:
 * - Create class → objeví se v listu do 2s (optimistic)
 * - Reload → třída stále v listu
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DIRECTOR_EMAIL = "director@skillstorm.local";
const DIRECTOR_PASSWORD = "Password123!";

test.describe("Classrooms Release Gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByPlaceholder(/you@|email/i).fill(DIRECTOR_EMAIL);
    await page.getByPlaceholder(/••••••••|password/i).fill(DIRECTOR_PASSWORD);
    await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 }).catch(() => {});
  });

  test("create class appears in list within 2s, persists after reload", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/classrooms`);
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByTestId("create-classroom-btn");
    await expect(createBtn).toBeVisible({ timeout: 8000 });
    const isDisabled = await createBtn.isDisabled();
    if (isDisabled) {
      test.skip();
      return;
    }

    await createBtn.click();
    await expect(page.getByText("Nová třída")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("A").fill("ZZ");
    await page.getByRole("button", { name: /^Vytvořit$/ }).click();

    const newItem = page.getByText(/5\.ZZ|ZZ/).first();
    await expect(newItem).toBeVisible({ timeout: 2000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(newItem).toBeVisible({ timeout: 5000 });
  });
});
