import {
  test,
  expect,
  loginStudent,
  loginTeacher,
  openFocusTest,
  expectFocusTestLoaded,
  ANY_ASSIGNMENT_ID,
  FOREIGN_ASSIGNMENT_ID,
} from "./helpers/focus";

/**
 * Focus Test Mode — access & security.
 *
 * Negative paths that must never leak test content: anonymous access, a foreign / non-assigned
 * assignment, and a role mismatch. Seed-independent (rely on the route guard + scoped backend).
 * Steps make the failing phase obvious; diagnostics attach the URL + UI state on failure.
 */
test.describe("Focus Test Mode — access & security", () => {
  test("anonymous user is bounced to login and sees no test content", async ({
    page,
  }) => {
    await test.step("open a focus test route while logged out", async () => {
      await page.context().clearCookies();
      await page.goto(`/app/assignments/${ANY_ASSIGNMENT_ID}/test`, {
        waitUntil: "commit",
      });
    });
    await test.step("guard redirects to login, no test content rendered", async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
      await expect(page.getByTestId("question-card")).toHaveCount(0);
    });
  });

  test("student cannot open a foreign / non-assigned test", async ({ page }) => {
    // A cross-org or non-assigned id is answered 403/404 by the scoped backend (no existence
    // leak). NOTE: a true "exists-but-forbidden" cross-tenant assertion would need a
    // deterministic multi-org assignment seed; this covers the same property via scoped-404.
    await test.step("student logs in", () => loginStudent(page));
    await test.step("open a foreign / non-assigned assignment id", () =>
      page.goto(`/app/assignments/${FOREIGN_ASSIGNMENT_ID}/test`, {
        waitUntil: "commit",
      }));
    await test.step("a safe error is shown and no test content renders", async () => {
      await expect(page.getByText(/Test nelze spustit/i)).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("focus-test-root")).toHaveCount(0);
      await expect(page.getByTestId("question-card")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Zpět na zadání/i }),
      ).toBeVisible();
    });
  });

  test("a teacher is denied the student focus route", async ({ page }) => {
    const isTeacher = await test.step("teacher logs in", () =>
      loginTeacher(page));
    test.skip(
      !isTeacher,
      "Skipped because the active seed does not include a teacher account.",
    );

    await test.step("teacher opens the student-only focus route", () =>
      page.goto(`/app/assignments/${ANY_ASSIGNMENT_ID}/test`, {
        waitUntil: "commit",
      }));
    await test.step("guard renders AccessDenied, never mounts the test", async () => {
      await expect(page.getByTestId("focus-test-root")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(page.getByTestId("question-card")).toHaveCount(0);
      await expect(
        page.getByText(/Access denied|Nemáš oprávnění/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("an authenticated student can open their assigned test", async ({
    page,
  }) => {
    // Positive control for the negative cases above.
    const id = await test.step("student opens assigned focus test", () =>
      openFocusTest(page));
    test.skip(
      !id,
      "Skipped because the active student seed has no open assignment to open.",
    );
    await test.step("focus shell + question card are visible", () =>
      expectFocusTestLoaded(page));
  });
});
