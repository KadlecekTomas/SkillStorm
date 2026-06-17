import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Focus Test Mode — full, SAFE end-to-end walkthrough of the student answering experience.
 *
 * Design goals:
 *  - Exercise the whole critical student flow (login → assignments → focus shell → answering →
 *    autosave → refresh recovery → offline block → review dialog → a11y/keyboard) as a single
 *    cohesive UX guard, not just one isolated widget.
 *  - Be RESILIENT: the flow depends on a seeded OPEN assignment for the student. When the
 *    environment has none, the dependent assertions skip with a clear reason instead of going
 *    falsely green or hard-failing.
 *  - Be NON-DESTRUCTIVE by default: it never finalises a submission (which would consume a
 *    seeded attempt and break re-runs). The real submit is opt-in via FOCUS_ALLOW_SUBMIT=1.
 */

const STUDENT_EMAIL =
  process.env.FOCUS_STUDENT_EMAIL ?? "student-d@zs.demo.local";
const PASSWORD = process.env.FOCUS_STUDENT_PASSWORD ?? "Password123!";
// Optional fallback seed (mirrors tests/e2e/deep/utils/auth.ts conventions).
const SEED_STUDENT_EMAIL =
  process.env.FOCUS_SEED_STUDENT_EMAIL ?? "student1@chodovicka.cz";
const SEED_PASSWORD = process.env.FOCUS_SEED_PASSWORD ?? "SkillStorm123!";

const BENIGN_CONSOLE = [
  "favicon",
  "ERR_BLOCKED_BY_CLIENT",
  "net::ERR_ABORTED",
  "Download the React DevTools",
  "[Fast Refresh]",
];

function attachConsoleGuards(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return { errors };
}

function criticalErrors(errors: string[]): string[] {
  return errors.filter((e) => {
    if (BENIGN_CONSOLE.some((b) => e.includes(b))) return false;
    // Optional-resource load failures (404/4xx for avatars, prefetches, icons…) are not app
    // crashes. We still treat 5xx resource failures, uncaught exceptions and hydration errors
    // as critical.
    if (/Failed to load resource/i.test(e) && !/status of 5\d\d/i.test(e)) {
      return false;
    }
    return true;
  });
}

async function tryLogin(
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

async function loginStudent(page: Page): Promise<void> {
  if (await tryLogin(page, STUDENT_EMAIL, PASSWORD)) return;
  // Fallback to the standard seed credentials used elsewhere in the suite.
  const ok = await tryLogin(page, SEED_STUDENT_EMAIL, SEED_PASSWORD);
  expect(ok, "student login failed with both demo and seed credentials").toBe(
    true,
  );
}

async function findOpenAssignmentId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/assignments/overview");
  if (!res.ok()) return null;
  const body = await res.json();
  const active = (body.data ?? body)?.active ?? [];
  return active[0]?.assignmentId ?? null;
}

async function openFocusTest(
  page: Page,
): Promise<{ assignmentId: string } | null> {
  await loginStudent(page);
  const assignmentId = await findOpenAssignmentId(page);
  if (!assignmentId) return null;
  await page.goto(`/app/assignments/${assignmentId}/test`, {
    waitUntil: "commit",
  });
  await expect(page.getByTestId("focus-test-root")).toBeVisible({
    timeout: 15_000,
  });
  return { assignmentId };
}

/** Answer the currently-shown question with whatever input it exposes. Returns true on success. */
async function answerCurrent(page: Page): Promise<boolean> {
  const card = page.getByTestId("question-card");
  await expect(card).toBeVisible();
  const option = page.getByTestId("answer-option").first();
  const fill = page.getByPlaceholder("Napiš odpověď");
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return true;
  }
  if (await fill.isVisible().catch(() => false)) {
    await fill.fill("walkthrough-answer");
    return true;
  }
  return false;
}

test.describe("Focus Test Mode — safe walkthrough", () => {
  // -------------------------------------------------------------------------
  // Test 1 — App smoke / no critical console errors on the entry surface.
  // -------------------------------------------------------------------------
  test("app boots without hydration/runtime errors", async ({ page }) => {
    const { errors } = attachConsoleGuards(page);
    await page.goto("/login", { waitUntil: "commit" });
    await expect(page.getByPlaceholder(/you@school\.edu/i)).toBeVisible({
      timeout: 15_000,
    });
    // No blank screen / infinite loader: a real form control is interactive.
    await expect(
      page.getByRole("button", { name: /sign in|přihlásit/i }),
    ).toBeEnabled();
    expect(criticalErrors(errors)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 2 — Auth and student entry to assignments.
  // -------------------------------------------------------------------------
  test("student logs in and reaches assignments", async ({ page }) => {
    const { errors } = attachConsoleGuards(page);
    await loginStudent(page);
    await page.goto("/app/assignments", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/app\/assignments/, { timeout: 15_000 });
    expect(criticalErrors(errors)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 3 — Focus shell renders chrome-free with the key controls.
  // -------------------------------------------------------------------------
  test("focus shell has no dashboard chrome and shows core controls", async ({
    page,
  }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    // No global app chrome leaks into the focus shell. Assert against the REAL dashboard
    // sidebar markers (its nav links + collapse control), not placeholder selectors.
    await expect(page.locator('a[href="/app/classrooms"]')).toHaveCount(0);
    await expect(page.locator('a[href="/app/tests"]')).toHaveCount(0);
    await expect(page.locator('a[href="/app/results"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /postranní panel/i }),
    ).toHaveCount(0);

    // Core orientation controls are present.
    await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
    await expect(page.getByTestId("save-status")).toBeVisible();
    await expect(page.getByTestId("question-card")).toBeVisible();
    await expect(page.getByTestId("question-navigator").first()).toBeVisible();
    await expect(page.getByTestId("submit-test")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 4 — Answering UX: selection, navigator + progress update, no key leak.
  // -------------------------------------------------------------------------
  test("answering updates selection, navigator and progress without leaking the answer key", async ({
    page,
  }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    // The sanitized session payload must not carry any answer key.
    const res = await page.request.get(
      `/api/assignments/${session!.assignmentId}/test-session`,
    );
    expect(res.ok()).toBeTruthy();
    const raw = await res.text();
    expect(raw).not.toMatch(/correctAnswer/i);
    expect(raw).not.toMatch(/"explanation"/i);

    const answered = await answerCurrent(page);
    test.skip(!answered, "First question exposed no answerable control.");

    // First navigator dot reflects the answered state, progress reaches "saved".
    await expect(
      page.getByTestId("question-nav-item").first(),
    ).toHaveAttribute("data-answered", "true", { timeout: 10_000 });
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );

    // Nothing in the live DOM exposes a correct/incorrect verdict before submit.
    for (const opt of await page.getByTestId("answer-option").all()) {
      expect(await opt.getAttribute("data-state")).toBeNull();
    }
  });

  // -------------------------------------------------------------------------
  // Test 5 — Autosave + refresh recovery.
  // -------------------------------------------------------------------------
  test("autosaves and recovers the answer after a reload", async ({ page }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    const answered = await answerCurrent(page);
    test.skip(!answered, "First question exposed no answerable control.");
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );

    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("focus-test-root")).toBeVisible({
      timeout: 15_000,
    });
    // The resumed attempt is clean (answer persisted server-side) and the dot stays answered.
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );
    await expect(
      page.getByTestId("question-nav-item").first(),
    ).toHaveAttribute("data-answered", "true", { timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Test 6 — Offline behaviour: submit blocked, then recoverable.
  // -------------------------------------------------------------------------
  test("blocks submit while offline and re-enables it after reconnect", async ({
    page,
    context,
  }: {
    page: Page;
    context: BrowserContext;
  }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    await context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toBeVisible({
      timeout: 10_000,
    });

    // Opening review while offline surfaces the block; confirm is disabled.
    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("review-offline-warning")).toBeVisible();
    await expect(page.getByTestId("confirm-submit")).toBeDisabled();

    await context.setOffline(false);
    // Back online the block clears and submit becomes actionable again.
    await expect(page.getByTestId("confirm-submit")).toBeEnabled({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------------
  // Test 7 — Review dialog summary + flag propagation.
  // -------------------------------------------------------------------------
  test("review dialog reflects flagged questions", async ({ page }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    await page.getByTestId("flag-question").click();
    await expect(page.getByTestId("flagged-count")).toBeVisible();

    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toContainText(/návratu/i);

    // Return to the test without submitting.
    await page.getByRole("button", { name: /zpět do testu/i }).click();
    await expect(page.getByTestId("review-submit-dialog")).toBeHidden();
  });

  // -------------------------------------------------------------------------
  // Test 8 — Real submit flow (OPT-IN; consumes a seeded attempt).
  // -------------------------------------------------------------------------
  test("submits and locks the attempt", async ({ page }) => {
    test.skip(
      process.env.FOCUS_ALLOW_SUBMIT !== "1",
      "Destructive: set FOCUS_ALLOW_SUBMIT=1 to run the real submit.",
    );
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    await answerCurrent(page);
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );
    await page.getByTestId("submit-test").click();
    await page.getByTestId("confirm-submit").click();

    // Lands on a results/confirmation surface per the current flow.
    await expect(page).toHaveURL(/\/app\/results\//, { timeout: 15_000 });

    // Re-opening the attempt no longer allows editing — it redirects to results.
    await page.goto(`/app/assignments/${session!.assignmentId}/test`, {
      waitUntil: "commit",
    });
    await expect(page).toHaveURL(/\/app\/results\//, { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // Test 9 — Accessibility basics: keyboard navigation + visible focus.
  // -------------------------------------------------------------------------
  test("supports keyboard navigation and review shortcut", async ({ page }) => {
    const session = await openFocusTest(page);
    test.skip(!session, "No open assignment seeded for the student.");

    // Flag shortcut.
    await page.keyboard.press("f");
    await expect(page.getByTestId("flag-question")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Review shortcut opens the dialog (never submits directly).
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // An option is reachable by keyboard and shows a focus ring.
    const option = page.getByTestId("answer-option").first();
    if (await option.isVisible().catch(() => false)) {
      await option.getByRole("radio").focus();
      await expect(option.getByRole("radio")).toBeFocused();
    }
  });

  // -------------------------------------------------------------------------
  // Test 10 — Reduced motion: the flow still works with animations suppressed.
  // -------------------------------------------------------------------------
  test("works under prefers-reduced-motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    try {
      const session = await openFocusTest(page);
      test.skip(!session, "No open assignment seeded for the student.");
      await expect(page.getByTestId("question-card")).toBeVisible();
      const answered = await answerCurrent(page);
      if (answered) {
        await expect(page.getByTestId("save-status")).toHaveAttribute(
          "data-status",
          "saved",
          { timeout: 10_000 },
        );
      }
    } finally {
      await ctx.close();
    }
  });
});
