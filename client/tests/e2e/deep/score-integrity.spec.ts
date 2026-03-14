/**
 * Score Integrity Spec
 *
 * Verifies that after a student submits a test:
 *   1. The displayed percentage score is mathematically consistent with
 *      the correct/incorrect response counts shown on the results page.
 *   2. The API-returned score matches what the UI renders.
 *   3. No NaN or impossible values appear anywhere in the UI.
 *
 * Strategy
 * ────────
 * This spec uses the API directly (via `page.request`) for the submission
 * flow so the assertions are deterministic — we know exactly what answers
 * we sent. The UI verifications load the results page afterwards.
 *
 * The spec depends on the full-walkthrough seed being present
 * (student1@skillstorm.local with at least one assignment).
 * It also falls back to the standard seed (student1@chodovicka.cz).
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { loginAsStudent, DEMO_USERS, DEMO_PASSWORD, SEED_USERS, SEED_PASSWORD } from "./utils/auth";
import { waitForProfile } from "./utils/auth";

// ---------------------------------------------------------------------------
// Types matching the API responses we'll use
// ---------------------------------------------------------------------------

type Assignment = {
  id: string;
  testId: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  attemptNo?: number;
};

type TestQuestion = {
  id: string;
  type: "TRUE_FALSE" | "FILL_IN_THE_BLANK" | "MULTIPLE_CHOICE";
  score: number | null;
  correctAnswer?: string | null;
  correctAnswers?: string[] | null;
  options?: Array<{ id: string; text: string }>;
};

type TestDetail = {
  id: string;
  title: string;
  questions: TestQuestion[];
};

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  score: number | null;
  submittedAt: string | null;
};

type AssignmentListItem = {
  id: string;
  testId: string;
  status?: string;
};

type AssignmentListResponse = {
  items?: AssignmentListItem[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a correct answer string for the given question. */
function correctAnswer(q: TestQuestion): string {
  if (q.type === "TRUE_FALSE") {
    return q.correctAnswer ?? "true";
  }
  if (q.type === "FILL_IN_THE_BLANK") {
    return q.correctAnswer ?? "answer";
  }
  // MULTIPLE_CHOICE
  const multi = q.correctAnswers ?? [];
  if (multi.length > 1) return JSON.stringify(multi);
  if (multi.length === 1) return multi[0]!;
  return q.correctAnswer ?? (q.options?.[0]?.text ?? "option");
}

/** Return a wrong answer string for the given question. */
function wrongAnswer(q: TestQuestion): string {
  if (q.type === "TRUE_FALSE") {
    return q.correctAnswer === "true" ? "false" : "true";
  }
  if (q.type === "FILL_IN_THE_BLANK") {
    return "__WRONG__";
  }
  // MULTIPLE_CHOICE — pick an option that is NOT in the correct set
  const correct = new Set([
    ...(q.correctAnswers ?? []),
    ...(q.correctAnswer ? [q.correctAnswer] : []),
  ]);
  const wrong = q.options?.find((o) => !correct.has(o.text))?.text;
  return wrong ?? "__WRONG__";
}

/**
 * Login and retrieve a JWT token via the API so we can make authenticated
 * API calls directly from the test.
 */
async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string | null> {
  const res = await request.post("/api/auth/login", {
    data: { email, password },
  });
  if (!res.ok()) return null;
  // JWT is set in the `ss_at` httpOnly cookie, not in the response body.
  // The JWT strategy also accepts Authorization: Bearer <token>, so we
  // extract the raw cookie value and use it as a Bearer token.
  const setCookie = res.headers()["set-cookie"] ?? "";
  const match = setCookie.match(/ss_at=([^;]+)/);
  return match?.[1] ?? null;
}

async function getAuthToken(request: APIRequestContext): Promise<string> {
  let token = await apiLogin(request, DEMO_USERS.student, DEMO_PASSWORD);
  if (!token) {
    token = await apiLogin(request, SEED_USERS.student, SEED_PASSWORD);
  }
  if (!token) throw new Error("Could not authenticate student for API calls");
  return token;
}

async function apiFetch<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const opts: Parameters<typeof request.fetch>[1] = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.data = body;
  const res = await request.fetch(`/api${path}`, opts);
  if (!res.ok()) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} → ${res.status()}: ${text}`);
  }
  const json = await res.json() as unknown;
  // Unwrap { success: true, data: T } envelope used by this API
  if (json && typeof json === "object" && "success" in (json as object) && "data" in (json as object)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Shared state (serial)
// ---------------------------------------------------------------------------

let token = "";
let assignmentId = "";
let testId = "";
let questions: TestQuestion[] = [];
let submissionId = "";
let expectedCorrect = 0;
let expectedIncorrect = 0;
let expectedScore = 0; // normalised 0–1

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Score integrity", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1 — Authenticate and find an open assignment
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 1 — Authenticate and find an open assignment", async ({ request }) => {
    token = await getAuthToken(request);

    const list = await apiFetch<AssignmentListResponse | AssignmentListItem[]>(
      request, "GET", "/assignments/my", token,
    );
    const items: AssignmentListItem[] = Array.isArray(list)
      ? list
      : (list?.items ?? []);

    const open = items.find(
      (a) => !a.status || a.status === "OPEN" || a.status === "PENDING",
    );
    if (!open) {
      test.skip();
      return;
    }

    assignmentId = open.id;
    testId = open.testId;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 2 — Load test questions
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 2 — Load test questions", async ({ request }) => {
    if (!testId) { test.skip(); return; }

    const detail = await apiFetch<TestDetail>(request, "GET", `/tests/${testId}`, token);
    questions = detail.questions ?? [];

    expect(questions.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 3 — Create submission and answer questions
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 3 — Create submission and answer all questions", async ({ request }) => {
    if (!assignmentId || questions.length === 0) { test.skip(); return; }

    // Create submission
    const created = await apiFetch<Submission>(
      request, "POST", "/submissions", token, { assignmentId },
    );
    submissionId = created.id;
    expect(submissionId).toBeTruthy();

    // Build responses: answer first half correctly, second half wrong
    const halfCorrect = Math.ceil(questions.length / 2);
    const responses = questions.map((q, idx) => ({
      questionId: q.id,
      givenText: idx < halfCorrect ? correctAnswer(q) : wrongAnswer(q),
    }));

    expectedCorrect = halfCorrect;
    expectedIncorrect = questions.length - halfCorrect;

    // Save responses
    await apiFetch(
      request, "PATCH", `/submissions/${submissionId}/responses`, token,
      { responses },
    );

    // Finish submission
    const finished = await apiFetch<Submission>(
      request, "POST", `/submissions/${submissionId}/finish`, token,
    );

    expect(finished.status).toMatch(/APPROVED|REJECTED/);
    expect(finished.score).not.toBeNull();

    expectedScore = finished.score ?? 0;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 4 — API: verify score is consistent with correct/incorrect counts
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 4 — API score is consistent with correct/incorrect response counts", async ({ request }) => {
    if (!submissionId || questions.length === 0) { test.skip(); return; }

    type SubmissionDetail = Submission & {
      responses?: Array<{ questionId: string; isCorrect: boolean | null }>;
    };

    const detail = await apiFetch<SubmissionDetail>(
      request, "GET", `/submissions/${submissionId}`, token,
    );

    const responses = detail.responses ?? [];

    // Only count responses that have a definite isCorrect value
    const evaluated = responses.filter((r) => r.isCorrect !== null);
    const correctCount = evaluated.filter((r) => r.isCorrect === true).length;
    const incorrectCount = evaluated.filter((r) => r.isCorrect === false).length;

    // Basic consistency: correct + incorrect = total evaluated
    expect(correctCount + incorrectCount).toBe(evaluated.length);

    // The score must be mathematically plausible:
    //   score (0–1) × totalEvaluated ≈ correctCount  (assuming equal weights)
    // We check with a tolerance of ±1 question's worth to allow weighted scoring.
    if (evaluated.length > 0) {
      const impliedCorrect = Math.round(expectedScore * evaluated.length);
      const tolerance = 1; // one question's weight
      expect(Math.abs(impliedCorrect - correctCount)).toBeLessThanOrEqual(tolerance);
    }

    // The stored score must equal the score returned at finish time
    expect(detail.score).toBeCloseTo(expectedScore, 3);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 5 — UI: results page shows non-NaN score consistent with the API
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 5 — UI results page shows valid score matching API value", async ({ page }) => {
    if (!submissionId || expectedScore === 0 && questions.length === 0) {
      test.skip();
      return;
    }

    await loginAsStudent(page);
    await page.goto(`/app/assignments/${assignmentId}`, { waitUntil: "commit" });
    await waitForProfile(page);

    // Wait for submission card to appear
    await page.waitForSelector('text=/Stav|Status|Score/i', { timeout: 12_000 });

    // No NaN anywhere on the page
    const nanTexts = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const found: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes("NaN")) {
          found.push(node.textContent.trim());
        }
      }
      return found;
    });
    expect(nanTexts, "NaN found in page text").toHaveLength(0);

    // Score display: find percentage text like "45 %" or "45%"
    const scoreRegex = /(\d+)\s*%/;
    const scoreEl = page.locator("text=/\\d+\\s*%/").first();
    const hasScore = await scoreEl.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasScore) {
      const scoreText = await scoreEl.textContent() ?? "";
      const match = scoreText.match(scoreRegex);
      if (match?.[1]) {
        const displayedPct = parseInt(match[1], 10);
        const expectedPct = Math.round(expectedScore * 100);

        // Allow ±2 percentage points due to rounding in different display paths
        expect(
          Math.abs(displayedPct - expectedPct),
          `UI shows ${displayedPct}% but API says ${expectedPct}%`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 6 — Teacher results view: score and counts are internally consistent
  // ──────────────────────────────────────────────────────────────────────────
  test("Phase 6 — Teacher results page shows consistent score vs. counts", async ({ page }) => {
    if (!testId) { test.skip(); return; }

    const { loginAsTeacher } = await import("./utils/auth");
    await loginAsTeacher(page);
    await page.goto(`/app/tests/${testId}/results`, { waitUntil: "commit" });
    await waitForProfile(page);

    // Wait for at least one result card
    const card = page.locator('[class*="Card"], .card').first();
    const cardVisible = await card.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!cardVisible) {
      // No cards yet — page might show "No results" message; that's fine
      return;
    }

    // No NaN anywhere
    const nanTexts = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const found: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes("NaN")) found.push(node.textContent.trim());
      }
      return found;
    });
    expect(nanTexts, "NaN found in teacher results page").toHaveLength(0);

    // For each result card: verify that if score is shown, correct + incorrect adds up
    // This is a best-effort check — cards may vary in what they expose
    const cards = page.locator('[class*="Card"], .card');
    const count = await cards.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const cardText = await cards.nth(i).textContent() ?? "";

      // Extract "Správně: X" and "Špatně: Y" if present
      const correctMatch = cardText.match(/Správně:\s*(\d+)/);
      const incorrectMatch = cardText.match(/Špatně:\s*(\d+)/);
      const scoreMatch = cardText.match(/(\d+)\s*%/);

      if (correctMatch?.[1] && incorrectMatch?.[1] && scoreMatch?.[1]) {
        const c = parseInt(correctMatch[1], 10);
        const w = parseInt(incorrectMatch[1], 10);
        const pct = parseInt(scoreMatch[1], 10);
        const total = c + w;

        // If total == 0, score must be 0 or not shown
        if (total === 0) {
          expect(pct).toBe(0);
        } else {
          // Computed percentage from counts
          const computedPct = Math.round((c / total) * 100);
          // Allow ±2 due to display rounding and unscored questions
          expect(
            Math.abs(pct - computedPct),
            `Card ${i}: score ${pct}% doesn't match counts (${c}/${total} = ${computedPct}%)`,
          ).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});
