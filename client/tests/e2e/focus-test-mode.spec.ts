import { test, expect, type Page } from "@playwright/test";

/**
 * Focus Test Mode UI e2e.
 *
 * Resilient by design: it depends on a seeded OPEN assignment for the student. When the
 * environment has none, the relevant assertions are skipped instead of failing. The flow
 * is non-destructive — it never completes a submit, so it stays re-runnable.
 */
const STUDENT_EMAIL = process.env.FOCUS_STUDENT_EMAIL ?? "student-d@zs.demo.local";
const PASSWORD = process.env.FOCUS_STUDENT_PASSWORD ?? "Password123!";

async function loginStudent(page: Page): Promise<void> {
  await page.goto("/login", { waitUntil: "commit" });
  await page.getByPlaceholder(/you@school\.edu/i).fill(STUDENT_EMAIL);
  await page.getByPlaceholder(/••••••••/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|přihlásit/i }).click();
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  await expect(page).not.toHaveURL(/\/login\/?$/i, { timeout: 15_000 });
}

async function findOpenAssignmentId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/assignments/overview");
  if (!res.ok()) return null;
  const body = await res.json();
  const active = (body.data ?? body)?.active ?? [];
  return active[0]?.assignmentId ?? null;
}

test.describe("Focus Test Mode", () => {
  test("distraction-free layout, autosave, refresh recovery and offline block", async ({
    page,
    context,
  }) => {
    await loginStudent(page);

    const assignmentId = await findOpenAssignmentId(page);
    test.skip(!assignmentId, "No open assignment seeded for the student.");

    await page.goto(`/app/assignments/${assignmentId}/test`, {
      waitUntil: "commit",
    });

    // 1) Focus shell renders without the dashboard chrome.
    await expect(page.getByTestId("focus-test-root")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="app-sidebar"]')).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toBeVisible();

    // 2) Answer the first question and wait for autosave to confirm.
    const radios = page.locator('input[type="radio"]');
    const fillInput = page.getByPlaceholder("Napiš odpověď");
    if ((await radios.count()) > 0) {
      await radios.first().check();
    } else {
      await fillInput.first().fill("autosave-check");
    }
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );

    // 3) Refresh — the resumed attempt has no unsaved changes (answer persisted server-side).
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByTestId("focus-test-root")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 10_000 },
    );

    // 4) Offline: indicator shows and submit is refused (draft stays local).
    await context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("submit-test").click();
    await expect(
      page.getByText(/nelze ho odevzdat bez připojení k internetu/i),
    ).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  });
});
