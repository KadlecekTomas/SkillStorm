import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs, navigateTo, USERS } from "./rbac-ux/helpers";

function apiPath(url: string): string {
  return new URL(url).pathname;
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function openFirstClassroom(page: Page): Promise<void> {
  const firstClassroom = page.locator('button[data-testid^="classroom-item-"]').first();
  await expect(firstClassroom).toBeVisible({ timeout: 15_000 });
  await firstClassroom.click();
}

test.describe("/app/classrooms resilience", () => {
  test("optional teachers and subjects failures do not break the classrooms page", async ({ page }) => {
    await loginAs(page, USERS.director);

    await page.route("**/api/**", async (route) => {
      const path = apiPath(route.request().url());
      if (path === "/api/teachers") {
        await fulfillJson(route, 412, {
          statusCode: 412,
          code: "ORG_NOT_READY",
          message: "Teachers unavailable for current readiness state",
        });
        return;
      }
      if (path === "/api/org-subjects") {
        await fulfillJson(route, 412, {
          statusCode: 412,
          code: "ORG_NOT_READY",
          message: "Org subjects unavailable for current readiness state",
        });
        return;
      }
      if (/^\/api\/class-sections\/[^/]+\/org-subjects$/.test(path)) {
        await fulfillJson(route, 412, {
          statusCode: 412,
          code: "ORG_NOT_READY",
          message: "Class subjects unavailable for current readiness state",
        });
        return;
      }
      await route.continue();
    });

    await navigateTo(page, "/app/classrooms");

    await expect(page.getByRole("heading", { name: "Třídy" })).toBeVisible();
    await expect(page.getByText("Učitele se nepodařilo načíst")).toBeVisible();
    await expect(page.getByText("Předměty se nepodařilo načíst")).toBeVisible();
    await expect(page.getByText("Nelze načíst stav aplikace")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Zkusit znovu" })).toHaveCount(0);

    const teacherFilterTrigger = page.locator('label:has-text("Učitel") button').first();
    await expect(teacherFilterTrigger).toBeDisabled();

    await openFirstClassroom(page);
    await expect(page.getByRole("button", { name: "Přidat žáky" })).toBeVisible();
    await expect(page.getByText("Třída zatím nemá přiřazené předměty.")).toBeVisible();
  });

  test("teacher structure failure shows fallback card and keeps the page usable", async ({ page }) => {
    await loginAs(page, USERS.teacher);

    await page.route("**/api/**", async (route) => {
      const path = apiPath(route.request().url());
      if (path === "/api/classrooms/my-structure") {
        await fulfillJson(route, 412, {
          statusCode: 412,
          code: "ORG_NOT_READY",
          message: "Teacher structure unavailable for current readiness state",
        });
        return;
      }
      await route.continue();
    });

    await navigateTo(page, "/app/classrooms");

    await expect(page.getByRole("heading", { name: "Třídy" })).toBeVisible();
    await expect(page.getByText("Vedlejší přehled tříd se nepodařilo načíst")).toBeVisible();
    await expect(page.getByText("Přehled tříd učitele není momentálně k dispozici.")).toBeVisible();
    await expect(page.getByText("Access denied")).toHaveCount(0);
    await expect(page.getByText("Nelze načíst stav aplikace")).toHaveCount(0);
  });

  test("critical classrooms failure shows blocking page error state", async ({ page }) => {
    await loginAs(page, USERS.director);

    await page.route("**/api/**", async (route) => {
      const path = apiPath(route.request().url());
      if (path === "/api/classrooms") {
        await fulfillJson(route, 500, {
          statusCode: 500,
          message: "Classrooms failed",
        });
        return;
      }
      await route.continue();
    });

    await navigateTo(page, "/app/classrooms");

    await expect(page.getByText("Chyba")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zkusit znovu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Třídy" })).toHaveCount(0);
  });

  test("critical current academic year failure shows blocking app-state error", async ({ page }) => {
    await loginAs(page, USERS.director);

    await page.route("**/api/**", async (route) => {
      const path = apiPath(route.request().url());
      if (path === "/api/academic-years/current") {
        await fulfillJson(route, 500, {
          statusCode: 500,
          code: "ACTIVE_YEAR_FETCH_FAILED",
          message: "Current academic year failed",
        });
        return;
      }
      await route.continue();
    });

    await navigateTo(page, "/app/classrooms");

    await expect(page.getByText("Nelze načíst stav aplikace")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zkusit znovu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Třídy" })).toHaveCount(0);
  });
});
