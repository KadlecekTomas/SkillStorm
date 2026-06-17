import { test, expect } from "@playwright/test";
import {
  loginStudent,
  loginTeacher,
  openFocusTest,
  ANY_ASSIGNMENT_ID,
  FOREIGN_ASSIGNMENT_ID,
} from "./helpers/focus";

/**
 * Focus Test Mode — access & security.
 *
 * Covers the negative paths that must never leak test content: anonymous access, a foreign /
 * non-assigned assignment, and a role mismatch. These are seed-independent (they rely on the
 * route guard + scoped backend, not on a specific assignment existing).
 */
test.describe("Focus Test Mode — access & security", () => {
  test("anonymous user is bounced to login and sees no test content", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(`/app/assignments/${ANY_ASSIGNMENT_ID}/test`, {
      waitUntil: "commit",
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
    await expect(page.getByTestId("question-card")).toHaveCount(0);
  });

  test("student cannot open a foreign / non-assigned test", async ({ page }) => {
    // A cross-org or non-assigned id is answered 403/404 by the scoped backend (no existence
    // leak). The focus shell must never render. NOTE: a true "exists-but-forbidden" cross-tenant
    // assertion would need a deterministic multi-org assignment seed; this covers the same
    // security property with the scoped-not-found path.
    await loginStudent(page);
    await page.goto(`/app/assignments/${FOREIGN_ASSIGNMENT_ID}/test`, {
      waitUntil: "commit",
    });
    await expect(page.getByText(/Test nelze spustit/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
    await expect(page.getByTestId("question-card")).toHaveCount(0);
    // A safe "back to assignments" affordance is offered instead of test content.
    await expect(
      page.getByRole("button", { name: /Zpět na zadání/i }),
    ).toBeVisible();
  });

  test("a teacher is denied the student focus route", async ({ page }) => {
    const isTeacher = await loginTeacher(page);
    test.skip(
      !isTeacher,
      "No teacher account available in the active seed — role-mismatch path not testable.",
    );

    await page.goto(`/app/assignments/${ANY_ASSIGNMENT_ID}/test`, {
      waitUntil: "commit",
    });
    // The student-only guard renders AccessDenied (FORBIDDEN) and never mounts the test.
    await expect(page.getByTestId("focus-test-root")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("question-card")).toHaveCount(0);
    await expect(
      page.getByText(/Access denied|Nemáš oprávnění/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("an authenticated student can open their assigned test", async ({
    page,
  }) => {
    // Positive control for the negative cases above.
    const id = await openFocusTest(page);
    test.skip(!id, "No open assignment seeded for the student.");
    await expect(page.getByTestId("test-top-status-bar")).toBeVisible();
    await expect(page.getByTestId("question-card")).toBeVisible();
  });
});
