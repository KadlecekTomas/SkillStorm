/**
 * Navigation helpers for deep system tests.
 */
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { waitForProfile } from "./auth";

// Re-export so spec files can import navigateTo from either utils module
export { navigateTo } from "./auth";

// ---------------------------------------------------------------------------
// Named routes
// ---------------------------------------------------------------------------

export const ROUTES = {
  dashboard: "/app",
  tests: "/app/tests",
  createTest: "/app/tests/create",
  classrooms: "/app/classrooms",
  assignments: "/app/assignments",
  results: "/app/results",
  settings: "/app/settings",
  teacherSettings: "/app/settings/teachers",
  academicYears: "/app/academic-years",
  analytics: "/app/analytics",
} as const;

// ---------------------------------------------------------------------------
// Page navigation
// ---------------------------------------------------------------------------

export async function goToTests(page: Page): Promise<void> {
  await page.goto(ROUTES.tests, { waitUntil: "commit" });
  await waitForProfile(page);
}

export async function goToDashboard(page: Page): Promise<void> {
  await page.goto(ROUTES.dashboard, { waitUntil: "commit" });
  await waitForProfile(page);
}

export async function goToCreateTest(page: Page): Promise<void> {
  await page.goto(ROUTES.createTest, { waitUntil: "commit" });
  await waitForProfile(page);
}

export async function goToAssignments(page: Page): Promise<void> {
  await page.goto(ROUTES.assignments, { waitUntil: "commit" });
  await waitForProfile(page);
}

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

export const SIDEBAR_NAV_LABELS = [
  "Přehled",
  "Třídy",
  "Testy",
  "Knihovna",
  "Výsledky",
  "Nastavení",
] as const;

export async function expectSidebarLoaded(page: Page): Promise<void> {
  // At least the first two nav items should be visible
  for (const label of SIDEBAR_NAV_LABELS.slice(0, 2)) {
    await expect(page.getByRole("link", { name: label })).toBeVisible({
      timeout: 8_000,
    });
  }
}

// ---------------------------------------------------------------------------
// Toast / alert helpers
// ---------------------------------------------------------------------------

/** Wait for any success toast or SuccessAlert to appear. */
export async function expectSuccessVisible(
  page: Page,
  timeout = 8_000,
): Promise<void> {
  // SuccessAlert uses title + description pattern
  const successIndicators = [
    page.locator('[role="alert"]').filter({ hasText: /hotovo|úspěch|byl/i }),
    page.locator(".toast").filter({ hasText: /úspěch|hotovo|byl/i }),
    page.getByText(/byl zadán|byl přiřazen|byl publikován|byl přidán|bylo vytvořeno|Submission byla/i),
  ];

  await Promise.race(
    successIndicators.map((loc) => loc.waitFor({ timeout, state: "visible" })),
  );
}

/** Wait for any error alert to appear. */
export async function expectErrorVisible(
  page: Page,
  timeout = 6_000,
): Promise<Locator> {
  const errLoc = page.locator('[role="alert"]').filter({ hasText: /.+/ }).first();
  await errLoc.waitFor({ timeout, state: "visible" });
  return errLoc;
}

// ---------------------------------------------------------------------------
// Data-table helpers
// ---------------------------------------------------------------------------

/** Get table row by partial text content. */
export function getTableRow(page: Page, text: string): Locator {
  return page.locator("tr").filter({ hasText: text });
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------

/** Wait for a dialog / modal to open. */
export async function waitForModal(page: Page, timeout = 5_000): Promise<void> {
  await page.locator('[role="dialog"]').waitFor({ state: "visible", timeout });
}

/** Close open modal via Cancel button. */
export async function closeModal(page: Page): Promise<void> {
  const cancelBtn = page.getByRole("button", { name: /Zrušit/i });
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
  }
}

// ---------------------------------------------------------------------------
// Misc page-state assertions
// ---------------------------------------------------------------------------

export async function expectNoSpinner(page: Page): Promise<void> {
  await expect(page.getByText("Kontroluji oprávnění")).not.toBeVisible({
    timeout: 12_000,
  });
}

export async function expectNoRawErrors(page: Page): Promise<void> {
  await expect(page.locator("pre")).not.toBeVisible();
  await expect(page.getByText("Něco se pokazilo")).not.toBeVisible();
}

export async function expectAccessDenied(page: Page): Promise<void> {
  await expect(page.getByText("Access denied")).toBeVisible({ timeout: 10_000 });
}

export async function expectNotAccessDenied(page: Page): Promise<void> {
  await expect(page.getByText("Access denied")).not.toBeVisible({
    timeout: 10_000,
  });
}
