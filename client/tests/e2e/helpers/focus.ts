import { expect, type Page } from "@playwright/test";

/**
 * Shared, resilient helpers for the Focus Test Mode e2e suite.
 *
 * These intentionally avoid hard-coded seed IDs and fixed timeouts. They work against either
 * seed world (the demo seed used by the local dev DB or the canonical e2e seed) by trying demo
 * credentials first and falling back to seed credentials, and by discovering an open assignment
 * dynamically. A resumed submission may already carry answers, so callers must not assume a
 * pristine attempt — every state assertion is written to tolerate that.
 */

// Credentials: demo seed first, canonical e2e seed as fallback. Override via env in CI.
const STUDENT_DEMO = {
  email: process.env.FOCUS_STUDENT_EMAIL ?? "student-d@zs.demo.local",
  password: process.env.FOCUS_STUDENT_PASSWORD ?? "Password123!",
};
const STUDENT_SEED = {
  email: process.env.FOCUS_SEED_STUDENT_EMAIL ?? "student1@chodovicka.cz",
  password: process.env.FOCUS_SEED_PASSWORD ?? "SkillStorm123!",
};
const TEACHER_DEMO = {
  email: process.env.FOCUS_TEACHER_EMAIL ?? "teacher1@zs.demo.local",
  password: process.env.FOCUS_TEACHER_PASSWORD ?? "Password123!",
};
const TEACHER_SEED = {
  email: process.env.FOCUS_SEED_TEACHER_EMAIL ?? "teacher@chodovicka.cz",
  password: process.env.FOCUS_SEED_PASSWORD ?? "SkillStorm123!",
};

/** A syntactically valid but non-assigned/foreign assignment id (cross-tenant / unknown). */
export const FOREIGN_ASSIGNMENT_ID = "11111111-1111-1111-1111-111111111111";
/** Any well-formed id — used to probe route guards before a session would load. */
export const ANY_ASSIGNMENT_ID = "00000000-0000-0000-0000-000000000000";

export const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone-class
export const TABLET_VIEWPORT = { width: 820, height: 1180 };

async function attemptLogin(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "commit" });
  await page.getByPlaceholder(/you@school\.edu/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(password);
  await page.getByRole("button", { name: /sign in|přihlásit/i }).click();
  return page
    .waitForURL(/\/(app|onboarding|dashboard)/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

export async function loginStudent(page: Page): Promise<void> {
  if (await attemptLogin(page, STUDENT_DEMO.email, STUDENT_DEMO.password)) return;
  const ok = await attemptLogin(page, STUDENT_SEED.email, STUDENT_SEED.password);
  expect(ok, "student login failed with demo and seed credentials").toBe(true);
}

/** Best-effort teacher login. Returns false (rather than failing) when no teacher seed exists. */
export async function loginTeacher(page: Page): Promise<boolean> {
  if (await attemptLogin(page, TEACHER_DEMO.email, TEACHER_DEMO.password))
    return true;
  return attemptLogin(page, TEACHER_SEED.email, TEACHER_SEED.password);
}

export async function findOpenAssignmentId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/assignments/overview");
  if (!res.ok()) return null;
  const body = await res.json();
  const active = (body.data ?? body)?.active ?? [];
  return active[0]?.assignmentId ?? null;
}

/** Log in as a student and open the first open assignment in Focus Test Mode. */
export async function openFocusTest(page: Page): Promise<string | null> {
  await loginStudent(page);
  const id = await findOpenAssignmentId(page);
  if (!id) return null;
  await page.goto(`/app/assignments/${id}/test`, { waitUntil: "commit" });
  await expect(page.getByTestId("focus-test-root")).toBeVisible({
    timeout: 15_000,
  });
  return id;
}

export type AnswerKind = "option" | "fill" | null;

/** Answer the currently shown question with whatever control it exposes. */
export async function answerCurrent(
  page: Page,
  fillValue = "trvalá odpověď",
): Promise<AnswerKind> {
  const option = page.getByTestId("answer-option").first();
  const fill = page.getByPlaceholder("Napiš odpověď");
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return "option";
  }
  if (await fill.isVisible().catch(() => false)) {
    await fill.fill(fillValue);
    return "fill";
  }
  return null;
}

/** Index of the first question whose nav dot reports `data-answered="false"`, or -1. */
export async function firstUnansweredIndex(page: Page): Promise<number> {
  const items = page.getByTestId("question-nav-item");
  const total = await items.count();
  for (let i = 0; i < total; i++) {
    if ((await items.nth(i).getAttribute("data-answered")) === "false") return i;
  }
  return -1;
}

/** Wait until autosave reports a fully-synced state. */
export async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved",
    { timeout: 10_000 },
  );
}
