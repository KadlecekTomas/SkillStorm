import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("school people management", () => {
  test.use({ storageState: "playwright/.auth/director.json" });

  for (const size of SIZES) {
    test(`director sees a clean people workspace on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto("/app/people");
      await expect(page.getByRole("heading", { name: "Lidé ve škole" })).toBeVisible();
      await expect(page.getByText("Žáci, učitelé a vedení na jednom místě.")).toBeVisible();
      await expect(page.getByRole("link", { name: /Přidat žáka/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Pozvat učitele/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Přidat vedení/ })).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);

      await page.screenshot({
        path: `test-results/people-${size.name}.png`,
        fullPage: true,
      });
    });
  }

  test("director can create teacher and leadership invites", async ({ page }) => {
    await page.goto("/app/people");

    const teacherInviteResponse = page.waitForResponse(
      (response) => response.url().includes("/invites") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Pozvat učitele/ }).click();
    expect((await teacherInviteResponse).status()).toBeLessThan(400);
    await expect(page.getByRole("dialog").getByLabel("Kód pozvánky")).not.toHaveValue("");
    await page.getByRole("button", { name: "Close" }).click().catch(() => undefined);
    await page.keyboard.press("Escape");

    const leadershipInviteResponse = page.waitForResponse(
      (response) => response.url().includes("/invites") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Přidat vedení/ }).click();
    expect((await leadershipInviteResponse).status()).toBeLessThan(400);
    await expect(page.getByRole("dialog").getByLabel("Kód pozvánky")).not.toHaveValue("");
  });

  test("teacher cannot issue a leadership invite through the API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "playwright/.auth/teacher.json" });
    const page = await context.newPage();
    await page.goto("/app");
    const status = await page.evaluate(async () => {
      const csrf = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("csrf_token="))
        ?.split("=")[1];
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify({ type: "ORG_ONLY", role: "DIRECTOR" }),
      });
      return response.status;
    });
    expect(status).toBe(403);
    await context.close();
  });
});
