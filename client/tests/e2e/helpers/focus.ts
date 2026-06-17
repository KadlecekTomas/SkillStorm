import {
  test as base,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

export type { Page, TestInfo } from "@playwright/test";

/**
 * Shared, resilient helpers + diagnostics for the Focus Test Mode e2e suite.
 *
 * Resilience: no hard-coded seed IDs, no fixed timeouts. Works against either seed world (the
 * demo seed used by the local dev DB or the canonical e2e seed) by trying demo credentials
 * first and falling back to seed credentials, and by discovering an open assignment
 * dynamically. A resumed submission may already carry answers, so callers must not assume a
 * pristine attempt.
 *
 * Diagnostics: import `test`/`expect` from this module instead of "@playwright/test". An auto
 * fixture records console errors + failed/4xx-5xx requests on the relevant API routes, and on
 * failure attaches a JSON snapshot of the focus UI state (URL, save status, progress, review
 * dialog, alerts, navigator counts) so a failing test says exactly where and why it broke.
 */

// ── Credentials: demo seed first, canonical e2e seed as fallback. Override via env in CI. ──
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

/** Which seed world the active credentials matched — surfaced as a test annotation. */
export type SeedWorld = "demo" | "seed";

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

/** Logs in the student and returns which seed world matched (annotated for diagnostics). */
export async function loginStudent(page: Page): Promise<SeedWorld> {
  if (await attemptLogin(page, STUDENT_DEMO.email, STUDENT_DEMO.password)) {
    annotate("seed-world", "demo");
    return "demo";
  }
  const ok = await attemptLogin(page, STUDENT_SEED.email, STUDENT_SEED.password);
  expect(ok, "student login failed with demo and seed credentials").toBe(true);
  annotate("seed-world", "seed");
  return "seed";
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
  annotate("assignment-id", id);
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

// ── Named, self-describing assertions ──────────────────────────────────────

/** The focus shell and its core controls are mounted. */
export async function expectFocusTestLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId("focus-test-root")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
  await expect(page.getByTestId("question-card")).toBeVisible();
}

/** No dashboard chrome (sidebar / its nav links / collapse control) leaks into focus mode. */
export async function expectFocusChromeHidden(page: Page): Promise<void> {
  await expect(page.locator('a[href="/app/classrooms"]')).toHaveCount(0);
  await expect(page.locator('a[href="/app/tests"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /postranní panel/i }),
  ).toHaveCount(0);
}

export async function expectSaveStatus(
  page: Page,
  status: "idle" | "saving" | "saved" | "offline" | "error",
): Promise<void> {
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    status,
    { timeout: 10_000 },
  );
}

/** Wait until autosave reports a fully-synced state. */
export async function expectSaved(page: Page): Promise<void> {
  await expectSaveStatus(page, "saved");
}

export async function expectReviewDialogOpen(page: Page): Promise<void> {
  await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
  await expect(page.getByTestId("progress-summary")).toBeVisible();
}

export type SubmitBlockReason = "offline" | "saving" | "saveError";

const BLOCK_REASON_TESTID: Record<SubmitBlockReason, string> = {
  offline: "review-offline-warning",
  saving: "review-unsaved-warning",
  saveError: "review-save-error-warning",
};

/** The final submit is disabled AND the matching reason is shown to the student. */
export async function expectSubmitBlockedBecause(
  page: Page,
  reason: SubmitBlockReason,
): Promise<void> {
  await expect(page.getByTestId("confirm-submit")).toBeDisabled();
  await expect(page.getByTestId(BLOCK_REASON_TESTID[reason])).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  // 2px tolerance for sub-pixel rounding / scrollbar.
  expect(
    overflow,
    `page overflows horizontally by ${overflow}px`,
  ).toBeLessThanOrEqual(2);
}

// ── Diagnostics ────────────────────────────────────────────────────────────

export interface FocusLogs {
  consoleErrors: string[];
  failedRequests: string[];
  badResponses: string[];
}

const API_OF_INTEREST = /\/(submissions|responses|assignments|auth|login)/;

/** Best-effort snapshot of the focus UI state. Never throws — missing fields read as null. */
export async function collectFocusDiagnostics(
  page: Page,
): Promise<Record<string, unknown>> {
  try {
    return await page.evaluate(() => {
      const q = (sel: string): Element | null => document.querySelector(sel);
      const txt = (el: Element | null): string =>
        (el?.textContent ?? "").trim();
      const nav = Array.from(
        document.querySelectorAll('[data-testid="question-nav-item"]'),
      );
      const countAttr = (attr: string): number =>
        nav.filter((n) => n.getAttribute(attr) === "true").length;
      const save = q('[data-testid="save-status"]');
      const confirm = q(
        '[data-testid="confirm-submit"]',
      ) as HTMLButtonElement | null;
      const alerts = Array.from(
        document.querySelectorAll(
          '[role="alert"], [data-testid$="-warning"], [data-testid$="-error"], [data-testid$="-indicator"]',
        ),
      )
        .map((e) => txt(e))
        .filter(Boolean)
        .slice(0, 10);
      return {
        url: location.pathname + location.search,
        heading: txt(document.querySelector("h1")) || null,
        focusShellPresent: !!q('[data-testid="focus-test-root"]'),
        saveStatus: save
          ? { text: txt(save), status: save.getAttribute("data-status") }
          : null,
        progressPercent: txt(q('[data-testid="progress-percent"]')) || null,
        questionPosition: txt(q('[data-testid="question-position"]')) || null,
        reviewDialogOpen: !!q('[data-testid="review-submit-dialog"]'),
        submitButton: confirm
          ? { present: true, disabled: confirm.disabled }
          : { present: false },
        navigator: {
          total: nav.length,
          answered: countAttr("data-answered"),
          started: countAttr("data-started"),
          flagged: countAttr("data-flagged"),
        },
        visibleAlerts: alerts,
      };
    });
  } catch (err) {
    return { collectError: String(err) };
  }
}

/** Attach a JSON diagnostics snapshot (UI state + captured console/network errors). */
export async function attachFocusDiagnostics(
  testInfo: TestInfo,
  page: Page,
  label: string,
  logs?: FocusLogs,
): Promise<void> {
  const ui = await collectFocusDiagnostics(page);
  const payload = {
    label,
    ...ui,
    consoleErrors: logs?.consoleErrors ?? [],
    failedRequests: logs?.failedRequests ?? [],
    badResponses: logs?.badResponses ?? [],
  };
  await testInfo.attach(`focus-diagnostics-${label}`, {
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json",
  });
}

function annotate(type: string, description: string): void {
  try {
    base.info().annotations.push({ type, description });
  } catch {
    // Outside a running test (helper used standalone) — annotations are a nice-to-have.
  }
}

interface FocusFixtures {
  /** Live console/network error capture for the current test (auto-enabled). */
  focusLogs: FocusLogs;
}

/**
 * Focus-aware `test`: import this instead of "@playwright/test". An auto fixture records
 * console errors and failed / 4xx-5xx API responses, and attaches a focus-state diagnostics
 * snapshot whenever the test does not finish with its expected status.
 */
export const test = base.extend<FocusFixtures>({
  focusLogs: [
    async ({ page }, use, testInfo): Promise<void> => {
      const logs: FocusLogs = {
        consoleErrors: [],
        failedRequests: [],
        badResponses: [],
      };
      page.on("console", (msg) => {
        if (msg.type() === "error") logs.consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        logs.consoleErrors.push(`pageerror: ${err.message}`);
      });
      page.on("requestfailed", (req) => {
        const url = req.url();
        if (API_OF_INTEREST.test(url)) {
          logs.failedRequests.push(
            `${req.method()} ${url} — ${req.failure()?.errorText ?? "failed"}`,
          );
        }
      });
      page.on("response", (res) => {
        const url = res.url();
        if (res.status() >= 400 && API_OF_INTEREST.test(url)) {
          logs.badResponses.push(
            `${res.status()} ${res.request().method()} ${url}`,
          );
        }
      });

      await use(logs);

      // On failure, attach the UI snapshot + captured logs so the report explains the failure.
      if (testInfo.status !== testInfo.expectedStatus) {
        await attachFocusDiagnostics(testInfo, page, "on-failure", logs).catch(
          () => {},
        );
      }
    },
    { auto: true },
  ],
});

export { expect };
