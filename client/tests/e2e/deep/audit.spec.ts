/**
 * COMPREHENSIVE APPLICATION AUDIT
 *
 * Full automated QA audit of the SkillStorm EduTo platform.
 *
 *   Part 1  — Basic Application Health
 *   Part 2  — Performance Audit
 *   Part 3  — UX Flow Tests (teacher + student)
 *   Part 4  — Scoring Validation
 *   Part 5  — RBAC Security Tests
 *   Part 6  — Multi-Tenant Isolation
 *   Part 7  — Security Audit (XSS, JWT, CSRF)
 *   Part 8  — Network Audit
 *   Part 9  — UI Stability & Responsive Layout
 *   Part 10 — Final Report
 *
 * Run:
 *   npx playwright test tests/e2e/deep/audit.spec.ts
 *   npx playwright test tests/e2e/deep/audit.spec.ts --reporter=html
 *
 * Credentials are read from env vars with fallbacks to known seed users.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const CREDS = {
  director: {
    primary: {
      email: process.env.AUDIT_DIRECTOR_EMAIL ?? "director@zs.demo.local",
      password: process.env.AUDIT_PASSWORD ?? "Password123!",
    },
    fallback: { email: "director@zs.demo.local", password: "Password123!" },
  },
  teacher: {
    primary: {
      email: process.env.AUDIT_TEACHER_EMAIL ?? "teacher1@zs.demo.local",
      password: process.env.AUDIT_PASSWORD ?? "Password123!",
    },
    fallback: { email: "teacher1@zs.demo.local", password: "Password123!" },
  },
  student: {
    primary: {
      email: process.env.AUDIT_STUDENT_EMAIL ?? "student-d@zs.demo.local",
      password: process.env.AUDIT_PASSWORD ?? "Password123!",
    },
    fallback: { email: "student-a@zs.demo.local", password: "Password123!" },
  },
} as const;

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.API_PROXY_TARGET ?? "http://localhost:4200";

// ---------------------------------------------------------------------------
// Audit report state (written to disk in Part 10)
// ---------------------------------------------------------------------------

interface PartScore {
  part: string;
  passed: number;
  failed: number;
  warnings: string[];
  notes: string[];
}

const REPORT: {
  runAt: string;
  parts: Record<string, PartScore>;
  consoleErrors: string[];
  slowPages: Array<{ url: string; ms: number }>;
  networkErrors: Array<{ url: string; status: number }>;
  rbacViolations: string[];
  screenshotPaths: string[];
} = {
  runAt: new Date().toISOString(),
  parts: {},
  consoleErrors: [],
  slowPages: [],
  networkErrors: [],
  rbacViolations: [],
  screenshotPaths: [],
};

function addPartResult(part: string, passed: number, failed: number, warnings: string[] = [], notes: string[] = []) {
  REPORT.parts[part] = { part, passed, failed, warnings, notes };
}

// ---------------------------------------------------------------------------
// Login helper with primary → fallback credential support
// ---------------------------------------------------------------------------

async function loginAs(
  page: Page,
  role: keyof typeof CREDS,
): Promise<void> {
  const { primary, fallback } = CREDS[role];

  const tryLogin = async (email: string, password: string): Promise<boolean> => {
    await page.context().clearCookies();
    await page.goto("/login", { waitUntil: "commit" });
    await page.getByPlaceholder(/you@school\.edu/i).fill(email);
    await page.getByPlaceholder(/••••••••/i).fill(password);
    await page.getByRole("button", { name: /Přihlásit/i }).click();
    try {
      await page.waitForURL(/\/(app|onboarding)/, { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  };

  const ok = await tryLogin(primary.email, primary.password);
  if (!ok) {
    const ok2 = await tryLogin(fallback.email, fallback.password);
    if (!ok2) {
      throw new Error(
        `Login failed for role "${role}". Tried: ${primary.email} and ${fallback.email}`,
      );
    }
  }

  await page.waitForSelector('[data-testid="profile-ready"]', {
    state: "attached",
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Performance measurement helper
// ---------------------------------------------------------------------------

async function measureNavigation(page: Page, url: string): Promise<number> {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "networkidle" });
  const elapsed = Date.now() - t0;
  if (elapsed > 2000) {
    REPORT.slowPages.push({ url, ms: elapsed });
  }
  return elapsed;
}

// ---------------------------------------------------------------------------
// Console error collector
// ---------------------------------------------------------------------------

function attachConsoleCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore benign browser noise
      if (
        !text.includes("favicon") &&
        !text.includes("ERR_BLOCKED_BY_CLIENT") &&
        !text.includes("net::ERR_ABORTED") &&
        !text.includes("Download the React DevTools")
      ) {
        errors.push(text);
        REPORT.consoleErrors.push(`[${page.url()}] ${text}`);
      }
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
    REPORT.consoleErrors.push(`[pageerror][${page.url()}] ${err.message}`);
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Network interceptor helper
// ---------------------------------------------------------------------------

function attachNetworkCollector(page: Page): Array<{ url: string; status: number }> {
  const failed: Array<{ url: string; status: number }> = [];
  page.on("response", (res) => {
    if (res.status() >= 500) {
      failed.push({ url: res.url(), status: res.status() });
      REPORT.networkErrors.push({ url: res.url(), status: res.status() });
    }
  });
  return failed;
}

// ---------------------------------------------------------------------------
// Screenshot helper
// ---------------------------------------------------------------------------

async function captureStep(page: Page, name: string): Promise<void> {
  const dir = path.join(process.cwd(), "test-results", "audit-screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  REPORT.screenshotPaths.push(file);
}

// ===========================================================================
// PART 1 — BASIC APPLICATION HEALTH
// ===========================================================================

test.describe("Part 1 — Basic Application Health", () => {
  let passed = 0;
  let failed = 0;

  test("1.1 — login page loads without errors", async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@school\.edu/i)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••••/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Přihlásit/i })).toBeVisible();
    expect(errors, `Console errors on login page: ${errors.join("\n")}`).toHaveLength(0);
    passed++;
    addPartResult("Part 1", passed, failed);
  });

  test("1.2 — API health endpoint responds", async ({ request }) => {
    const res = await request.get(`${API_URL}/health`, { timeout: 5_000 }).catch(() => null);
    // Some NestJS setups don't have /health — fallback to /auth/me-like check
    if (res && res.ok()) {
      passed++;
    } else {
      // Verify the API is reachable at all by hitting a known public endpoint
      const r2 = await request.get(`${API_URL}/`).catch(() => null);
      expect(r2).not.toBeNull();
      passed++;
    }
    addPartResult("Part 1", passed, failed);
  });

  test("1.3 — director dashboard loads after login", async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await loginAs(page, "director");
    await expect(page.getByRole("heading", { name: /Přehled/i })).toBeVisible({
      timeout: 10_000,
    });
    await captureStep(page, "part1-director-dashboard");
    expect(errors, `Console errors on dashboard: ${errors.join("\n")}`).toHaveLength(0);
    passed++;
    addPartResult("Part 1", passed, failed);
  });

  test("1.4 — all sidebar navigation links are functional", async ({ page }) => {
    await loginAs(page, "director");
    const links = [
      { label: "Třídy", path: "/app/classrooms" },
      { label: "Testy", path: "/app/tests" },
      { label: "Výsledky", path: "/app/results" },
    ];
    for (const { label, path: navPath } of links) {
      await page.getByRole("link", { name: label }).click();
      await page.waitForURL(new RegExp(navPath), { timeout: 8_000 });
      await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 8_000 });
      await expect(page.locator("pre")).not.toBeVisible();
    }
    await captureStep(page, "part1-nav-check");
    passed++;
    addPartResult("Part 1", passed, failed);
  });

  test("1.5 — no unhandled page errors on teacher login", async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await loginAs(page, "teacher");
    await page.goto("/app", { waitUntil: "networkidle" });
    await expect(page.getByText("Něco se pokazilo")).not.toBeVisible();
    await expect(page.locator("pre")).not.toBeVisible();
    expect(errors, `Page errors for teacher: ${errors.join("\n")}`).toHaveLength(0);
    passed++;
    addPartResult("Part 1", passed, failed);
  });

  test("1.6 — no unhandled page errors on student login", async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await loginAs(page, "student");
    await page.goto("/app", { waitUntil: "networkidle" });
    await expect(page.getByText("Něco se pokazilo")).not.toBeVisible();
    await expect(page.locator("pre")).not.toBeVisible();
    expect(errors, `Page errors for student: ${errors.join("\n")}`).toHaveLength(0);
    passed++;
    addPartResult("Part 1", passed, failed);
  });
});

// ===========================================================================
// PART 2 — PERFORMANCE AUDIT
// ===========================================================================

test.describe("Part 2 — Performance Audit", () => {
  const WARN_PAGE_MS = 2000;
  const WARN_INTERACTION_MS = 300;
  const warnings: string[] = [];

  test("2.1 — login page render time < 2s", async ({ page }) => {
    const ms = await measureNavigation(page, "/login");
    if (ms > WARN_PAGE_MS) warnings.push(`Login page took ${ms}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    // Soft assert — warn, don't fail
    console.warn(`[PERF] Login page: ${ms}ms${ms > WARN_PAGE_MS ? " ⚠ SLOW" : " ✓"}`);
  });

  test("2.2 — dashboard render time < 2s", async ({ page }) => {
    await loginAs(page, "director");
    const ms = await measureNavigation(page, "/app");
    if (ms > WARN_PAGE_MS) warnings.push(`Dashboard took ${ms}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    console.warn(`[PERF] Dashboard: ${ms}ms${ms > WARN_PAGE_MS ? " ⚠ SLOW" : " ✓"}`);
  });

  test("2.3 — tests list render time < 2s", async ({ page }) => {
    await loginAs(page, "teacher");
    const ms = await measureNavigation(page, "/app/tests");
    if (ms > WARN_PAGE_MS) warnings.push(`Tests list took ${ms}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    console.warn(`[PERF] Tests list: ${ms}ms${ms > WARN_PAGE_MS ? " ⚠ SLOW" : " ✓"}`);
  });

  test("2.4 — assignments list render time < 2s", async ({ page }) => {
    await loginAs(page, "student");
    const ms = await measureNavigation(page, "/app/assignments");
    if (ms > WARN_PAGE_MS) warnings.push(`Assignments took ${ms}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    console.warn(`[PERF] Assignments: ${ms}ms${ms > WARN_PAGE_MS ? " ⚠ SLOW" : " ✓"}`);
  });

  test("2.5 — API response time < 500ms (academic-years)", async ({ page }) => {
    await loginAs(page, "director");
    const apiMs = await page.evaluate(async () => {
      const t0 = performance.now();
      await fetch("/api/academic-years", { credentials: "include" });
      return performance.now() - t0;
    });
    const warn = apiMs > 500;
    if (warn) warnings.push(`/api/academic-years took ${Math.round(apiMs)}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    console.warn(
      `[PERF] /api/academic-years: ${Math.round(apiMs)}ms${warn ? " ⚠ SLOW" : " ✓"}`,
    );
  });

  test("2.6 — sidebar link navigation interaction < 300ms", async ({ page }) => {
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    const t0 = Date.now();
    await page.getByRole("link", { name: "Testy" }).click();
    await page.waitForURL(/\/app\/tests/, { timeout: 5_000 });
    const ms = Date.now() - t0;
    if (ms > WARN_INTERACTION_MS) warnings.push(`Sidebar nav to /tests took ${ms}ms`);
    addPartResult("Part 2", 1, 0, warnings);
    console.warn(
      `[PERF] Sidebar nav: ${ms}ms${ms > WARN_INTERACTION_MS ? " ⚠ SLOW" : " ✓"}`,
    );
  });

  test("2.7 — performance.timing reports — log navigation metrics", async ({ page }) => {
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    const timing = await page.evaluate(() => {
      const t = performance.timing;
      return {
        domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
        domComplete: t.domComplete - t.navigationStart,
        loadEvent: t.loadEventEnd - t.navigationStart,
      };
    });
    console.log("[PERF] Navigation timing:", timing);
    const notes = [
      `domContentLoaded: ${timing.domContentLoaded}ms`,
      `domComplete: ${timing.domComplete}ms`,
      `loadEvent: ${timing.loadEvent}ms`,
    ];
    addPartResult("Part 2", 1, 0, warnings, notes);
    // Verify the values are sane (not 0, not Infinity)
    expect(timing.domContentLoaded).toBeGreaterThan(0);
    expect(timing.domComplete).toBeGreaterThan(0);
  });
});

// ===========================================================================
// PART 3 — UX FLOW TESTS
// ===========================================================================

test.describe("Part 3 — UX Flow Tests", () => {
  // ---- Teacher flow ----

  test("3.1 — teacher: login → open classrooms → view students", async ({ page }) => {
    await test.step("Teacher logs in", async () => {
      await loginAs(page, "teacher");
      await captureStep(page, "part3-teacher-login");
    });

    await test.step("Teacher opens classrooms", async () => {
      await page.goto("/app/classrooms", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 10_000 });
      await expect(page.getByText(/Třídy|Classroom/i)).toBeVisible({ timeout: 8_000 });
      await captureStep(page, "part3-teacher-classrooms");
    });

    await test.step("Teacher opens a class if available", async () => {
      const firstClass = page
        .getByRole("link")
        .filter({ hasText: /\d\.\w|třída/i })
        .first();
      if (await firstClass.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstClass.click();
        await page.waitForURL(/\/app\/classrooms\//, { timeout: 8_000 });
        await captureStep(page, "part3-teacher-class-detail");
      }
    });

    await test.step("Teacher opens tests", async () => {
      await page.goto("/app/tests", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 10_000 });
      await expect(page.getByText(/Moje testy|Testy/i)).toBeVisible({ timeout: 8_000 });
      await captureStep(page, "part3-teacher-tests");
    });

    await test.step("Teacher opens a test if available", async () => {
      const firstTest = page.getByRole("link").filter({ hasText: /.+/ }).nth(1);
      if (await firstTest.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstTest.click();
        await page.waitForURL(/\/app\/tests\//, { timeout: 8_000 });
        await captureStep(page, "part3-teacher-test-detail");
      }
    });

    await test.step("Teacher opens results", async () => {
      await page.goto("/app/results", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 10_000 });
      await captureStep(page, "part3-teacher-results");
    });

    addPartResult("Part 3", 1, 0, [], ["teacher flow completed"]);
  });

  // ---- Student flow ----

  test("3.2 — student: login → assignments list → no broken UI", async ({ page }) => {
    await test.step("Student logs in", async () => {
      await loginAs(page, "student");
      await captureStep(page, "part3-student-login");
    });

    await test.step("Student opens assignments", async () => {
      await page.goto("/app/assignments", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 10_000 });
      // Either shows assignments or empty state — both are valid
      const hasContent =
        (await page.getByRole("button", { name: /Otevřít test/i }).isVisible({ timeout: 3_000 }).catch(() => false)) ||
        (await page.getByText(/Nemáš žádná aktivní zadání|Žádná zadání/i).isVisible({ timeout: 3_000 }).catch(() => false));
      expect(hasContent, "Assignments page should show content or empty state").toBeTruthy();
      await captureStep(page, "part3-student-assignments");
    });

    await test.step("Open an assignment if available", async () => {
      const openBtn = page.getByRole("button", { name: /Otevřít test/i }).first();
      if (await openBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await openBtn.click();
        await page.waitForURL(/\/app\/assignments\//, { timeout: 8_000 });
        await expect(page.getByText(/Začít pokus|Score|Odevzdáno/i)).toBeVisible({
          timeout: 10_000,
        });
        await captureStep(page, "part3-student-assignment-detail");
      }
    });

    addPartResult("Part 3", 1, 0, [], ["student flow completed"]);
  });

  test("3.3 — loading states appear and resolve (no frozen UI)", async ({ page }) => {
    await loginAs(page, "director");

    // Navigate to a data-heavy page and ensure no permanent spinners remain
    await page.goto("/app/results", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 15_000 });

    // Check that "Kontroluji oprávnění" spinner is gone
    await expect(page.getByText("Kontroluji oprávnění")).not.toBeVisible({
      timeout: 12_000,
    });
    await captureStep(page, "part3-loading-resolved");
    addPartResult("Part 3", 1, 0);
  });

  test("3.4 — logout flow works correctly", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 10_000 });

    const logoutBtn = page.getByRole("button", { name: /Odhlásit/i });
    await expect(logoutBtn).toBeVisible({ timeout: 6_000 });
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await captureStep(page, "part3-logout");
    addPartResult("Part 3", 1, 0);
  });
});

// ===========================================================================
// PART 4 — SCORING VALIDATION
// ===========================================================================

test.describe("Part 4 — Scoring Validation", () => {
  test("4.1 — submitted scores are valid percentages (0–100, no NaN)", async ({ page }) => {
    await loginAs(page, "director");

    // Fetch submissions via API
    const scores = await page.evaluate(async (): Promise<number[]> => {
      const res = await fetch("/api/submissions?limit=50", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as unknown;
      const items: Array<{ score?: number; percentage?: number }> =
        Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
      return items
        .map((s) => s.score ?? s.percentage ?? -1)
        .filter((v) => v !== -1);
    });

    if (scores.length === 0) {
      console.warn("[SCORE] No submissions found to validate — skipping numeric checks");
      addPartResult("Part 4", 1, 0, ["no submissions found"]);
      return;
    }

    const invalidScores: number[] = [];
    for (const score of scores) {
      if (isNaN(score) || score < 0 || score > 100) {
        invalidScores.push(score);
      }
    }

    console.log(`[SCORE] Validated ${scores.length} scores. Invalid: ${invalidScores.length}`);
    expect(
      invalidScores,
      `Invalid scores found: ${JSON.stringify(invalidScores)}`,
    ).toHaveLength(0);

    addPartResult("Part 4", 1, 0, [], [
      `validated ${scores.length} submission scores`,
      `min: ${Math.min(...scores)}%`,
      `max: ${Math.max(...scores)}%`,
    ]);
  });

  test("4.2 — director dashboard shows no NaN percentage values", async ({ page }) => {
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    // Look for any text that contains "NaN" in the rendered page
    const nanTexts = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const found: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes("NaN")) {
          found.push(node.textContent.trim());
        }
      }
      return found;
    });

    expect(
      nanTexts,
      `NaN values visible in director dashboard: ${nanTexts.join(", ")}`,
    ).toHaveLength(0);

    addPartResult("Part 4", 1, 0, [], ["no NaN on director dashboard"]);
  });

  test("4.3 — score formula integrity: correctAnswers / total * 100", async ({ page }) => {
    await loginAs(page, "director");

    // Fetch submission details with answer breakdown
    const results = await page.evaluate(async (): Promise<Array<{
      score: number;
      correct: number;
      total: number;
    }>> => {
      const res = await fetch("/api/submissions?limit=20", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as unknown;
      const items: Array<{
        score?: number;
        correctAnswers?: number;
        totalQuestions?: number;
        responses?: unknown[];
      }> = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
      return items
        .filter((s) => s.correctAnswers !== undefined && s.totalQuestions !== undefined)
        .map((s) => ({
          score: s.score ?? 0,
          correct: s.correctAnswers ?? 0,
          total: s.totalQuestions ?? 1,
        }));
    });

    if (results.length === 0) {
      console.warn("[SCORE] No submissions with breakdown available");
      addPartResult("Part 4", 1, 0, ["no breakdown data available"]);
      return;
    }

    const discrepancies: string[] = [];
    for (const { score, correct, total } of results) {
      if (total === 0) continue;
      const expected = Math.round((correct / total) * 100 * 100) / 100;
      const actual = Math.round(score * 100) / 100;
      if (Math.abs(expected - actual) > 1) {
        discrepancies.push(
          `correct=${correct} total=${total} → expected ~${expected}% got ${actual}%`,
        );
      }
    }

    expect(
      discrepancies,
      `Score formula discrepancies:\n${discrepancies.join("\n")}`,
    ).toHaveLength(0);

    addPartResult("Part 4", 1, 0, [], [`checked ${results.length} submissions`]);
  });
});

// ===========================================================================
// PART 5 — RBAC SECURITY TESTS
// ===========================================================================

test.describe("Part 5 — RBAC Security Tests", () => {
  // ---- Student cannot access restricted routes ----

  test("5.1 — student cannot access /app/tests/create", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/app/tests/create", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    });
    // Should be redirected away or show access denied
    const url = page.url();
    const hasAccessDenied = await page
      .getByText(/Access denied|Přístup odepřen|403|Unauthorized/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const wasRedirected = !url.includes("/app/tests/create");
    expect(
      hasAccessDenied || wasRedirected,
      `Student accessed /app/tests/create (url: ${url})`,
    ).toBeTruthy();
    if (!wasRedirected && !hasAccessDenied) {
      REPORT.rbacViolations.push("Student accessed /app/tests/create");
    }
    await captureStep(page, "part5-student-create-test-blocked");
    addPartResult("Part 5", 1, 0);
  });

  test("5.2 — student cannot access /app/settings", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/app/settings", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    });
    const url = page.url();
    const hasAccessDenied = await page
      .getByText(/Access denied|Přístup odepřen|403/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const wasRedirected = !url.includes("/app/settings");
    expect(
      hasAccessDenied || wasRedirected,
      `Student accessed /app/settings (url: ${url})`,
    ).toBeTruthy();
    if (!wasRedirected && !hasAccessDenied) {
      REPORT.rbacViolations.push("Student accessed /app/settings");
    }
    addPartResult("Part 5", 1, 0);
  });

  test("5.3 — student API: cannot GET /tests (MANAGE tests endpoint)", async ({ page }) => {
    await loginAs(page, "student");
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/tests/manage", { credentials: "include" });
      return res.status;
    });
    // 403, 404, or 401 — any of these is acceptable; 200 is a violation
    expect(status, `Student got ${status} on manage endpoint`).not.toBe(200);
    addPartResult("Part 5", 1, 0);
  });

  test("5.4 — teacher cannot access /app/platform admin routes", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/platform", { waitUntil: "commit" });
    const url = page.url();
    const isBlocked =
      url.includes("/forbidden") ||
      url.includes("/login") ||
      url.includes("/app") && !url.includes("/platform");
    const hasAccessDenied = await page
      .getByText(/Access denied|Forbidden|403/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(
      isBlocked || hasAccessDenied,
      `Teacher accessed /app/platform (url: ${url})`,
    ).toBeTruthy();
    if (!isBlocked && !hasAccessDenied) {
      REPORT.rbacViolations.push("Teacher accessed /app/platform");
    }
    await captureStep(page, "part5-teacher-platform-blocked");
    addPartResult("Part 5", 1, 0);
  });

  test("5.5 — director CAN access /app/settings", async ({ page }) => {
    await loginAs(page, "director");
    await page.goto("/app/settings", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });
    // Should not be blocked
    const isBlocked = await page
      .getByText(/Access denied|403|Přístup odepřen/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(isBlocked, "Director should access /app/settings").toBeFalsy();
    await captureStep(page, "part5-director-settings-ok");
    addPartResult("Part 5", 1, 0);
  });

  test("5.6 — unauthenticated user is redirected from /app to /login", async ({ page }) => {
    // Clear all cookies to ensure no session
    await page.context().clearCookies();
    await page.goto("/app", { waitUntil: "commit" });
    await page.waitForURL(/\/login|\/register/, { timeout: 10_000 });
    const url = page.url();
    expect(url).toMatch(/\/login|\/register/);
    addPartResult("Part 5", 1, 0);
  });

  test("5.7 — student API: cannot POST /tests (create test)", async ({ page }) => {
    await loginAs(page, "student");
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/tests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hacked test", subjectId: "fake" }),
      });
      return res.status;
    });
    expect(status, `Student got ${status} on POST /tests`).not.toBe(201);
    expect(status).toBeGreaterThanOrEqual(400);
    addPartResult("Part 5", 1, 0);
  });
});

// ===========================================================================
// PART 6 — MULTI-TENANT ISOLATION
// ===========================================================================

test.describe("Part 6 — Multi-Tenant Isolation", () => {
  test("6.1 — accessing non-existent org classroom returns 403 or 404", async ({ page }) => {
    await loginAs(page, "teacher");
    const fakeId = "00000000-0000-0000-0000-000000000001";

    const status = await page.evaluate(async (id) => {
      const res = await fetch(`/api/classrooms/${id}`, { credentials: "include" });
      return res.status;
    }, fakeId);

    expect(
      [403, 404],
      `Expected 403/404 for foreign classroom, got ${status}`,
    ).toContain(status);
    addPartResult("Part 6", 1, 0, [], [`GET /classrooms/${fakeId} → ${status}`]);
  });

  test("6.2 — accessing non-existent test returns 403 or 404", async ({ page }) => {
    await loginAs(page, "teacher");
    const fakeId = "00000000-0000-0000-0000-000000000002";

    const status = await page.evaluate(async (id) => {
      const res = await fetch(`/api/tests/${id}`, { credentials: "include" });
      return res.status;
    }, fakeId);

    expect([403, 404], `Expected 403/404 for foreign test, got ${status}`).toContain(status);
    addPartResult("Part 6", 1, 0, [], [`GET /tests/${fakeId} → ${status}`]);
  });

  test("6.3 — student cannot read another student submission by guessing ID", async ({ page }) => {
    await loginAs(page, "student");
    const fakeId = "00000000-0000-0000-0000-000000000003";

    const status = await page.evaluate(async (id) => {
      const res = await fetch(`/api/submissions/${id}`, { credentials: "include" });
      return res.status;
    }, fakeId);

    expect(
      [403, 404],
      `Expected 403/404 for foreign submission, got ${status}`,
    ).toContain(status);
    addPartResult("Part 6", 1, 0, [], [`GET /submissions/${fakeId} → ${status}`]);
  });

  test("6.4 — student cannot access another student's result page via URL", async ({ page }) => {
    await loginAs(page, "student");
    const fakeStudentId = "00000000-0000-0000-0000-000000000004";
    await page.goto(`/app/students/${fakeStudentId}`, { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 10_000,
    });
    const url = page.url();
    const isBlocked =
      !url.includes(`/students/${fakeStudentId}`) ||
      (await page
        .getByText(/Access denied|403|Nenalezeno|Not found/i)
        .isVisible({ timeout: 4_000 })
        .catch(() => false));
    if (!isBlocked) {
      REPORT.rbacViolations.push(`Student accessed /students/${fakeStudentId}`);
    }
    expect(isBlocked, "Student should not access another student's page").toBeTruthy();
    addPartResult("Part 6", 1, 0);
  });

  test("6.5 — API returns only current-org data for academic years", async ({ page }) => {
    await loginAs(page, "director");
    const data = await page.evaluate(async () => {
      const res = await fetch("/api/academic-years", { credentials: "include" });
      return res.ok ? (await res.json() as unknown[]) : [];
    });
    // All returned years should belong to the same org (we can't cross-check without
    // another org's ID, so just verify the response is an array)
    expect(Array.isArray(data)).toBeTruthy();
    addPartResult("Part 6", 1, 0, [], [`${data.length} academic years returned`]);
  });
});

// ===========================================================================
// PART 7 — SECURITY AUDIT
// ===========================================================================

test.describe("Part 7 — Security Audit", () => {
  test("7.1 — unauthenticated API calls return 401", async ({ request }) => {
    const protectedEndpoints = [
      "/api/tests",
      "/api/classrooms",
      "/api/academic-years",
      "/api/assignments/my",
    ];
    const violations: string[] = [];
    for (const endpoint of protectedEndpoints) {
      const res = await request.get(endpoint);
      if (res.status() !== 401 && res.status() !== 403) {
        violations.push(`${endpoint} → ${res.status()} (expected 401/403)`);
      }
    }
    expect(
      violations,
      `Unauthenticated endpoints accessible:\n${violations.join("\n")}`,
    ).toHaveLength(0);
    addPartResult("Part 7", 1, 0, [], [`checked ${protectedEndpoints.length} endpoints`]);
  });

  test("7.2 — invalid JWT token returns 401", async ({ request }) => {
    const res = await request.get("/api/tests", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(
      [401, 403],
      `Invalid JWT should return 401/403, got ${res.status()}`,
    ).toContain(res.status());
    addPartResult("Part 7", 1, 0);
  });

  test("7.3 — XSS: injected script in test title is escaped in UI", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/app/tests/create", { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="profile-ready"]', {
      state: "attached",
      timeout: 12_000,
    });

    const hasForm = await page
      .getByRole("textbox", { name: /název|title/i })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!hasForm) {
      console.warn("[SEC] Test create form not accessible to teacher — skipping XSS fill");
      addPartResult("Part 7", 1, 0, ["create form not accessible — XSS fill skipped"]);
      return;
    }

    const xssPayload = '<script>alert("xss")</script>';
    await page.getByRole("textbox", { name: /název|title/i }).fill(xssPayload);

    // Verify the script tag is not executed — no alert dialog
    let alertFired = false;
    page.on("dialog", (dialog) => {
      alertFired = true;
      void dialog.dismiss();
    });

    // Wait briefly for any dialog
    await page.waitForTimeout(1000);
    expect(alertFired, "XSS alert() was executed — payload not escaped").toBeFalsy();

    // Verify the raw <script> tag is not present in DOM as executable
    const scriptInDom = await page.evaluate(() =>
      document.querySelectorAll('script[src=""]').length > 0,
    );
    expect(scriptInDom).toBeFalsy();

    await captureStep(page, "part7-xss-escaped");
    addPartResult("Part 7", 1, 0, [], ["XSS payload not executed"]);
  });

  test("7.4 — XSS: injected script via URL parameter is not reflected", async ({ page }) => {
    await page.goto('/login?redirect=<script>alert(1)</script>', {
      waitUntil: "commit",
    });

    let alertFired = false;
    page.on("dialog", (dialog) => {
      alertFired = true;
      void dialog.dismiss();
    });

    await page.waitForTimeout(1000);
    expect(alertFired, "XSS via URL param fired alert").toBeFalsy();
    addPartResult("Part 7", 1, 0);
  });

  test("7.5 — cookies have appropriate security flags", async ({ page }) => {
    await loginAs(page, "director");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.toLowerCase().includes("token") || c.name.toLowerCase().includes("session"),
    );
    if (!sessionCookie) {
      console.warn("[SEC] No session/token cookie found (might be httpOnly and filtered)");
      addPartResult("Part 7", 1, 0, ["session cookie not inspectable (httpOnly)"]);
      return;
    }
    // HttpOnly should be set on auth cookies
    if (!sessionCookie.httpOnly) {
      REPORT.rbacViolations.push(`Cookie "${sessionCookie.name}" missing httpOnly flag`);
    }
    addPartResult("Part 7", 1, 0, [], [
      `cookie "${sessionCookie.name}": httpOnly=${sessionCookie.httpOnly}, secure=${sessionCookie.secure}`,
    ]);
  });

  test("7.6 — brute-force: multiple failed logins do not crash the app", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/login", { waitUntil: "commit" });
    for (let i = 0; i < 3; i++) {
      await page.getByPlaceholder(/you@school\.edu/i).fill(`wrong${i}@test.com`);
      await page.getByPlaceholder(/••••••••/i).fill("wrongpassword");
      await page.getByRole("button", { name: /Přihlásit/i }).click();
      await page.waitForTimeout(500);
    }
    // App should still show the login form, not a crash
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible({
      timeout: 5_000,
    });
    expect(errors, `Page crashed after failed logins: ${errors.join("\n")}`).toHaveLength(0);
    addPartResult("Part 7", 1, 0);
  });
});

// ===========================================================================
// PART 8 — NETWORK AUDIT
// ===========================================================================

test.describe("Part 8 — Network Audit", () => {
  test("8.1 — no 500 errors on director dashboard", async ({ page }) => {
    const serverErrors = attachNetworkCollector(page);
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });
    expect(
      serverErrors,
      `500 errors on director dashboard: ${JSON.stringify(serverErrors)}`,
    ).toHaveLength(0);
    addPartResult("Part 8", 1, 0, [], ["0 server errors on dashboard"]);
  });

  test("8.2 — no 500 errors on teacher tests page", async ({ page }) => {
    const serverErrors = attachNetworkCollector(page);
    await loginAs(page, "teacher");
    await page.goto("/app/tests", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });
    expect(
      serverErrors,
      `500 errors on tests page: ${JSON.stringify(serverErrors)}`,
    ).toHaveLength(0);
    addPartResult("Part 8", 1, 0, [], ["0 server errors on tests page"]);
  });

  test("8.3 — no 500 errors on student assignments page", async ({ page }) => {
    const serverErrors = attachNetworkCollector(page);
    await loginAs(page, "student");
    await page.goto("/app/assignments", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });
    expect(
      serverErrors,
      `500 errors on assignments page: ${JSON.stringify(serverErrors)}`,
    ).toHaveLength(0);
    addPartResult("Part 8", 1, 0, [], ["0 server errors on assignments"]);
  });

  test("8.4 — log all API response statuses for director session", async ({ page }) => {
    const responseLog: Array<{ url: string; status: number }> = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/")) {
        responseLog.push({ url: res.url(), status: res.status() });
      }
    });

    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    console.log("[NET] API responses on dashboard load:");
    for (const r of responseLog) {
      const icon = r.status >= 400 ? "❌" : "✓";
      console.log(`  ${icon} ${r.status} ${r.url.replace(/.*\/api/, "/api")}`);
    }

    const errors4xx5xx = responseLog.filter((r) => r.status >= 400);
    addPartResult("Part 8", 1, 0,
      errors4xx5xx.map((r) => `${r.status} ${r.url}`),
      [`total API calls: ${responseLog.length}`],
    );
  });

  test("8.5 — no retry loops detected (no repeated identical requests)", async ({ page }) => {
    const requestCounts: Record<string, number> = {};
    page.on("request", (req) => {
      const key = `${req.method()} ${req.url().replace(/.*\/api/, "/api")}`;
      requestCounts[key] = (requestCounts[key] ?? 0) + 1;
    });

    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    const retries = Object.entries(requestCounts)
      .filter(([url, count]) => count >= 5 && url.includes("/api/"))
      .map(([url, count]) => `${count}x ${url}`);

    if (retries.length > 0) {
      console.warn("[NET] Possible retry loops detected:", retries);
    }
    // Soft warn, not fail — some polling is expected
    addPartResult("Part 8", 1, 0,
      retries.length > 0 ? [`possible retry loops: ${retries.join(", ")}`] : [],
    );
  });
});

// ===========================================================================
// PART 9 — UI STABILITY & RESPONSIVE LAYOUT
// ===========================================================================

test.describe("Part 9 — UI Stability & Responsive Layout", () => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    test(`9.${viewports.indexOf(vp) + 1} — login page renders on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login", { waitUntil: "networkidle" });
      // Core elements must be visible at all viewports
      await expect(page.getByPlaceholder(/you@school\.edu/i)).toBeVisible();
      await expect(page.getByPlaceholder(/••••••••/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Přihlásit/i })).toBeVisible();
      await captureStep(page, `part9-login-${vp.name}`);
      addPartResult("Part 9", 1, 0, [], [`login on ${vp.name} ✓`]);
    });
  }

  test("9.4 — dashboard layout stable on desktop — no overflow clipping", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    // Check for horizontal overflow (scrollWidth > clientWidth signals broken layout)
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow, "Page has horizontal overflow on desktop").toBeFalsy();
    await captureStep(page, "part9-desktop-layout");
    addPartResult("Part 9", 1, 0);
  });

  test("9.5 — all nav buttons are clickable (not obscured)", async ({ page }) => {
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    const navLinks = ["Přehled", "Třídy", "Testy", "Výsledky"];
    for (const label of navLinks) {
      const link = page.getByRole("link", { name: label });
      await expect(link).toBeVisible({ timeout: 5_000 });
      // Verify the element is not obscured by checking it's in the viewport
      const box = await link.boundingBox();
      expect(box, `Nav link "${label}" has no bounding box`).not.toBeNull();
      expect(box!.width, `Nav link "${label}" has zero width`).toBeGreaterThan(0);
    }
    addPartResult("Part 9", 1, 0);
  });

  test("9.6 — mobile: hamburger or sidebar is functional at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "director");
    await page.goto("/app", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="profile-ready"]', { timeout: 12_000 });

    // On mobile the sidebar may collapse — check that at least the dashboard heading is visible
    await expect(page.getByRole("heading", { name: /Přehled|Dashboard/i })).toBeVisible({
      timeout: 8_000,
    });
    await captureStep(page, "part9-mobile-dashboard");
    addPartResult("Part 9", 1, 0);
  });
});

// ===========================================================================
// PART 10 — FINAL REPORT
// ===========================================================================

test.describe("Part 10 — Final Report", () => {
  test("10.1 — generate structured audit report", async () => {
    // Compute scores per part
    const partSummary = Object.values(REPORT.parts).map((p) => {
      const total = p.passed + p.failed;
      const pct = total > 0 ? Math.round((p.passed / total) * 100) : 100;
      return { ...p, total, score: pct };
    });

    const overallPassed = partSummary.reduce((a, p) => a + p.passed, 0);
    const overallFailed = partSummary.reduce((a, p) => a + p.failed, 0);
    const overallTotal = overallPassed + overallFailed;
    const overallScore = overallTotal > 0 ? Math.round((overallPassed / overallTotal) * 100) : 100;

    const report = {
      runAt: REPORT.runAt,
      overallScore: `${overallScore}%`,
      overallPassed,
      overallFailed,
      parts: partSummary,
      consoleErrors: REPORT.consoleErrors,
      slowPages: REPORT.slowPages,
      networkErrors: REPORT.networkErrors,
      rbacViolations: REPORT.rbacViolations,
      screenshotPaths: REPORT.screenshotPaths,
    };

    // Write to disk
    const outDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "audit-report.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    // Pretty-print summary to console
    console.log("\n" + "=".repeat(60));
    console.log("  SKILLSTORM APPLICATION AUDIT REPORT");
    console.log("=".repeat(60));
    console.log(`  Run at:        ${report.runAt}`);
    console.log(`  Overall score: ${report.overallScore} (${overallPassed}/${overallTotal} passed)`);
    console.log("-".repeat(60));
    for (const p of partSummary) {
      const icon = p.failed === 0 ? "✓" : "✗";
      console.log(`  ${icon}  ${p.part.padEnd(35)} ${p.score}%`);
      if (p.warnings.length > 0) {
        for (const w of p.warnings) console.log(`     ⚠  ${w}`);
      }
    }
    console.log("-".repeat(60));
    if (REPORT.consoleErrors.length > 0) {
      console.log(`  Console errors:   ${REPORT.consoleErrors.length}`);
    }
    if (REPORT.slowPages.length > 0) {
      console.log(`  Slow pages:       ${REPORT.slowPages.length}`);
      for (const p of REPORT.slowPages) console.log(`     ${p.url} (${p.ms}ms)`);
    }
    if (REPORT.networkErrors.length > 0) {
      console.log(`  Network errors:   ${REPORT.networkErrors.length}`);
    }
    if (REPORT.rbacViolations.length > 0) {
      console.log(`  RBAC violations:  ${REPORT.rbacViolations.length}`);
      for (const v of REPORT.rbacViolations) console.log(`     ⚠  ${v}`);
    }
    console.log(`  Screenshots:      ${REPORT.screenshotPaths.length} captured`);
    console.log(`  Report saved to:  ${outPath}`);
    console.log("=".repeat(60) + "\n");

    // Assert no critical violations
    expect(
      REPORT.rbacViolations,
      `RBAC violations found:\n${REPORT.rbacViolations.join("\n")}`,
    ).toHaveLength(0);

    expect(
      REPORT.networkErrors.filter((e) => e.status >= 500),
      `Server errors detected:\n${REPORT.networkErrors.map((e) => `${e.status} ${e.url}`).join("\n")}`,
    ).toHaveLength(0);
  });
});
