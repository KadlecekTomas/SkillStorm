import { test, expect, type Page } from "@playwright/test";

/**
 * Focus Test Mode — upgraded UX coverage.
 *
 * Verifies the answering-experience upgrade on top of the existing safe walkthrough:
 * position indicator ("Otázka N z M"), progress percentage, the "rozepsaná" (started) state,
 * "Přeskočit", in-session answer persistence across navigation, plus auth/assignment negative
 * paths. Resilient to a missing seed (skips with a reason) and non-destructive by default —
 * the real submit + double-submit guard run only with FOCUS_ALLOW_SUBMIT=1.
 */
const STUDENT_EMAIL =
  process.env.FOCUS_STUDENT_EMAIL ?? "student-d@zs.demo.local";
const PASSWORD = process.env.FOCUS_STUDENT_PASSWORD ?? "Password123!";
const SEED_STUDENT_EMAIL =
  process.env.FOCUS_SEED_STUDENT_EMAIL ?? "student1@chodovicka.cz";
const SEED_PASSWORD = process.env.FOCUS_SEED_PASSWORD ?? "SkillStorm123!";

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
  const ok = await tryLogin(page, SEED_STUDENT_EMAIL, SEED_PASSWORD);
  expect(ok, "student login failed with demo and seed credentials").toBe(true);
}

async function findOpenAssignmentId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/assignments/overview");
  if (!res.ok()) return null;
  const body = await res.json();
  const active = (body.data ?? body)?.active ?? [];
  return active[0]?.assignmentId ?? null;
}

async function openFocusTest(page: Page): Promise<boolean> {
  await loginStudent(page);
  const id = await findOpenAssignmentId(page);
  if (!id) return false;
  await page.goto(`/app/assignments/${id}/test`, { waitUntil: "commit" });
  await expect(page.getByTestId("focus-test-root")).toBeVisible({
    timeout: 15_000,
  });
  return true;
}

/** Answer the current question with whatever control it exposes; returns "option" | "fill" | null. */
async function answerCurrent(page: Page): Promise<"option" | "fill" | null> {
  const option = page.getByTestId("answer-option").first();
  const fill = page.getByPlaceholder("Napiš odpověď");
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return "option";
  }
  if (await fill.isVisible().catch(() => false)) {
    await fill.fill("trvalá odpověď");
    return "fill";
  }
  return null;
}

test.describe("Focus Test Mode — UX upgrade", () => {
  test("shows position, percentage, skip control and a started state", async ({
    page,
  }) => {
    const ok = await openFocusTest(page);
    test.skip(!ok, "No open assignment seeded for the student.");

    // Position + percentage indicators.
    await expect(page.getByTestId("question-position")).toHaveText(
      /Otázka\s+1\s+z\s+\d+/,
    );
    await expect(page.getByTestId("progress-percent")).toHaveText(/%/);
    await expect(page.getByTestId("skip-question")).toBeVisible();

    const total = await page.getByTestId("question-nav-item").count();
    test.skip(total < 2, "Need at least 2 questions for navigation coverage.");

    // Leave q1 unanswered and move on → q1 becomes "rozepsaná" (started).
    await page.getByRole("button", { name: /Další/i }).click();
    await expect(page.getByTestId("question-position")).toHaveText(
      /Otázka\s+2\s+z\s+\d+/,
    );
    await expect(
      page.getByTestId("question-nav-item").first(),
    ).toHaveAttribute("data-started", "true");
  });

  test("keeps answers when navigating between questions", async ({ page }) => {
    const ok = await openFocusTest(page);
    test.skip(!ok, "No open assignment seeded for the student.");
    const total = await page.getByTestId("question-nav-item").count();
    test.skip(total < 2, "Need at least 2 questions.");

    const kind = await answerCurrent(page);
    test.skip(!kind, "First question exposed no answerable control.");
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );

    // Navigate away and back — the answer must survive the question change.
    await page.getByRole("button", { name: /Další/i }).click();
    await expect(page.getByTestId("question-position")).toHaveText(
      /Otázka\s+2\s+z\s+\d+/,
    );
    await page.getByRole("button", { name: /Předchozí/i }).click();

    await expect(
      page.getByTestId("question-nav-item").first(),
    ).toHaveAttribute("data-answered", "true");
    if (kind === "option") {
      await expect(
        page.locator('[data-testid="answer-option"][data-selected="true"]'),
      ).toHaveCount(1);
    } else {
      await expect(page.getByPlaceholder("Napiš odpověď")).toHaveValue(
        "trvalá odpověď",
      );
    }
  });

  test("skip jumps to a still-unanswered question", async ({ page }) => {
    const ok = await openFocusTest(page);
    test.skip(!ok, "No open assignment seeded for the student.");
    const total = await page.getByTestId("question-nav-item").count();
    test.skip(total < 2, "Need at least 2 questions.");

    const kind = await answerCurrent(page);
    test.skip(!kind, "First question exposed no answerable control.");
    await page.getByTestId("skip-question").click();
    // Moved off q1 to a later unanswered question.
    await expect(page.getByTestId("question-position")).not.toHaveText(
      /Otázka\s+1\s+z/,
    );
  });

  test("review dialog summarises answered / unanswered / flagged", async ({
    page,
  }) => {
    const ok = await openFocusTest(page);
    test.skip(!ok, "No open assignment seeded for the student.");

    await answerCurrent(page);
    await page.getByTestId("flag-question").click();
    await page.getByTestId("submit-test").click();
    await expect(page.getByTestId("review-submit-dialog")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toBeVisible();
    await expect(page.getByTestId("progress-summary")).toContainText(/návratu/i);
    await page.getByRole("button", { name: /zpět do testu/i }).click();
    await expect(page.getByTestId("review-submit-dialog")).toBeHidden();
  });

  // --- Negative / security paths -------------------------------------------

  test("unauthenticated user cannot open a focus test", async ({ page }) => {
    await page.context().clearCookies();
    // Any id — the route guard must bounce an anonymous user before loading anything.
    await page.goto("/app/assignments/00000000-0000-0000-0000-000000000000/test", {
      waitUntil: "commit",
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
  });

  test("a student cannot open an unknown / non-assigned test", async ({
    page,
  }) => {
    await loginStudent(page);
    await page.goto(
      "/app/assignments/11111111-1111-1111-1111-111111111111/test",
      { waitUntil: "commit" },
    );
    // Backend answers 404/403 for a cross-org or non-assigned id → focus shell never renders.
    await expect(page.getByText(/Test nelze spustit/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
  });

  // --- Real submit + double-submit guard (opt-in: consumes an attempt) -----

  test("submits once and prevents a double submit", async ({ page }) => {
    test.skip(
      process.env.FOCUS_ALLOW_SUBMIT !== "1",
      "Destructive: set FOCUS_ALLOW_SUBMIT=1 to run the real submit.",
    );
    const ok = await openFocusTest(page);
    test.skip(!ok, "No open assignment seeded for the student.");

    await answerCurrent(page);
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );
    await page.getByTestId("submit-test").click();
    const confirm = page.getByTestId("confirm-submit");
    await confirm.click();
    // The confirm button locks immediately (loading state) — no second submit possible.
    await expect(confirm).toBeDisabled();
    await expect(page).toHaveURL(/\/app\/results\//, { timeout: 15_000 });
  });
});
