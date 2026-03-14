/**
 * Auth helpers for deep system tests.
 *
 * Credentials are read from environment variables with fallbacks to the
 * demo-flow-seed defaults (director@skillstorm.local / Password123!).
 *
 * To run against the standard e2e seed (chodovicka.cz), set:
 *   DEEP_DIRECTOR_EMAIL=director@chodovicka.cz
 *   DEEP_PASSWORD=SkillStorm123!
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export const DEMO_PASSWORD = process.env.DEEP_PASSWORD ?? "Password123!";

export const DEMO_USERS = {
  director: process.env.DEEP_DIRECTOR_EMAIL ?? "director@skillstorm.local",
  teacher: process.env.DEEP_TEACHER_EMAIL ?? "teacher.a@skillstorm.local",
  student: process.env.DEEP_STUDENT_EMAIL ?? "student1@skillstorm.local",
} as const;

// Fallback: standard seed credentials used by existing rbac-ux tests
export const SEED_PASSWORD = "SkillStorm123!";
export const SEED_USERS = {
  director: "director@chodovicka.cz",
  teacher: "teacher@chodovicka.cz",
  student: "student1@chodovicka.cz",
} as const;

// ---------------------------------------------------------------------------
// Login helpers
// ---------------------------------------------------------------------------

/**
 * Login via the real login form and wait for the app shell to be ready.
 * Tries DEMO credentials first; if the page doesn't land on /app within 10s
 * it tries SEED credentials (useful in CI where only one seed is loaded).
 */
export async function loginAs(
  page: Page,
  role: keyof typeof DEMO_USERS,
): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "commit" });

  const email = DEMO_USERS[role];
  const password = DEMO_PASSWORD;

  await page.getByPlaceholder(/you@school\.edu/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(password);
  await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();

  await page
    .waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 })
    .catch(async () => {
      // Fallback: try seed credentials
      await page.context().clearCookies();
      await page.goto("/login", { waitUntil: "commit" });
      const seedEmail = SEED_USERS[role];
      await page.getByPlaceholder(/you@school\.edu/i).fill(seedEmail);
      await page.getByPlaceholder(/••••••••/i).fill(SEED_PASSWORD);
      await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
      await page.waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 });
    });

  await waitForProfile(page);
}

export async function loginAsDirector(page: Page) {
  return loginAs(page, "director");
}

export async function loginAsTeacher(page: Page) {
  return loginAs(page, "teacher");
}

export async function loginAsStudent(page: Page) {
  return loginAs(page, "student");
}

// ---------------------------------------------------------------------------
// Readiness helpers
// ---------------------------------------------------------------------------

/** Wait for the GuardBoundary profile-ready marker. */
export async function waitForProfile(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="profile-ready"]', {
    state: "attached",
    timeout: 12_000,
  });
}

/** Navigate and wait for profile. */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "commit" });
  await waitForProfile(page);
}

// ---------------------------------------------------------------------------
// Logout helper
// ---------------------------------------------------------------------------

export async function logout(page: Page): Promise<void> {
  // The user menu / logout button lives in the sidebar bottom section
  const logoutBtn = page.getByRole("button", { name: /Odhlásit/i });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  } else {
    // Some layouts need to open a menu first
    await page.getByRole("button", { name: /user menu|avatar/i }).click();
    await page.getByRole("menuitem", { name: /Odhlásit/i }).click();
  }
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Console error collector
// ---------------------------------------------------------------------------

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

export function assertNoCriticalErrors(errors: string[]): void {
  const critical = errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("ERR_BLOCKED_BY_CLIENT") &&
      !e.includes("net::ERR_ABORTED"),
  );
  expect(critical).toHaveLength(0);
}
