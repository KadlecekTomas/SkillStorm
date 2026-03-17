import { test, expect, type Page } from "@playwright/test";

const PASSWORD = process.env.DEEP_PASSWORD ?? "Password123!";
const SEED_PASSWORD = "SkillStorm123!";
const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL || "admin@skillstorm.local";
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD || "ChangeMeImmediately!";

const USERS = {
  DIRECTOR: {
    primaryEmail: process.env.DEEP_DIRECTOR_EMAIL ?? "director@skillstorm.local",
    fallbackEmail: "director@chodovicka.cz",
    primaryPassword: PASSWORD,
    fallbackPassword: SEED_PASSWORD,
    startPath: "/app",
  },
  TEACHER: {
    primaryEmail: process.env.DEEP_TEACHER_EMAIL ?? "teacher.a@skillstorm.local",
    fallbackEmail: "teacher@chodovicka.cz",
    primaryPassword: PASSWORD,
    fallbackPassword: SEED_PASSWORD,
    startPath: "/app",
  },
  STUDENT: {
    primaryEmail: process.env.DEEP_STUDENT_EMAIL ?? "student1@skillstorm.local",
    fallbackEmail: "student1@chodovicka.cz",
    primaryPassword: PASSWORD,
    fallbackPassword: SEED_PASSWORD,
    startPath: "/app",
  },
  SUPERADMIN: {
    primaryEmail: SUPERADMIN_EMAIL,
    fallbackEmail: SUPERADMIN_EMAIL,
    primaryPassword: SUPERADMIN_PASSWORD,
    fallbackPassword: SUPERADMIN_PASSWORD,
    startPath: "/app/platform",
  },
} as const;

async function loginViaForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "commit" });
  await page.getByPlaceholder(/you@school\.edu|you@|email/i).fill(email);
  await page.getByPlaceholder(/••••••••|password/i).fill(password);
  await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
}

async function loginAs(page: Page, role: keyof typeof USERS): Promise<void> {
  const user = USERS[role];
  await page.context().clearCookies();

  await loginViaForm(page, user.primaryEmail, user.primaryPassword);
  await page.waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 }).catch(async () => {
    await page.context().clearCookies();
    await loginViaForm(page, user.fallbackEmail, user.fallbackPassword);
    await page.waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 });
  });
}

async function clickLogout(page: Page): Promise<void> {
  const directLogoutButton = page.getByRole("button", { name: /Log out|Odhlásit/i }).first();
  if (await directLogoutButton.click({ timeout: 5_000 }).then(() => true).catch(() => false)) {
    return;
  }

  await page.getByRole("button", { name: /Menu uživatele|user menu|avatar/i }).click();
  await page.getByRole("menuitem", { name: /Odhlásit/i }).click();
}

for (const role of Object.keys(USERS) as Array<keyof typeof USERS>) {
  test(`logout redirects ${role} to /login and never /app/platform/forbidden`, async ({ page }) => {
    const user = USERS[role];

    await loginAs(page, role);
    await page.goto(user.startPath, { waitUntil: "commit" });

    await clickLogout(page);

    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(page.url()).not.toContain("/app/platform/forbidden");

    await page.goto("/app", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 10_000 });
    expect(page.url()).not.toContain("/app/platform/forbidden");
  });
}
