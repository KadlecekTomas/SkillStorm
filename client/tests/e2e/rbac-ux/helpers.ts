/**
 * Shared helpers for RBAC UX e2e tests.
 * Uses REAL backend (no MSW). Requires seeded database.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Seed credentials
// ---------------------------------------------------------------------------

export const PASSWORD = "SkillStorm123!";

export const USERS = {
  owner: "owner@chodovicka.cz",
  director: "director@chodovicka.cz",
  teacher: "teacher@chodovicka.cz",
  student: "student1@chodovicka.cz",
  parent: "parent@chodovicka.cz",
} as const;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Login via the real login form and wait for the app shell to be ready. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder(/you@school\.edu/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 });
  await waitForProfile(page);
}

/** Wait for the GuardBoundary to emit the profile-ready marker. */
export async function waitForProfile(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="profile-ready"]', {
    state: "attached",
    timeout: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Navigation selectors
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  "Overview",
  "Classrooms",
  "Tests",
  "Library",
  "Results",
  "Settings",
] as const;

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Assert no console errors during navigation. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** Navigate and wait for profile marker. */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "commit" });
  await waitForProfile(page);
}

/** Assert the Access Denied component is visible. */
export async function expectAccessDenied(page: Page): Promise<void> {
  await expect(page.getByText("Access denied")).toBeVisible({ timeout: 10_000 });
}

/** Assert all sidebar nav links are present. */
export async function expectAllNavItems(page: Page): Promise<void> {
  for (const label of NAV_ITEMS) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }
}
