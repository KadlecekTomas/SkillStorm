import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve(process.cwd(), "screenshots/defense");

const TEST_TITLE = "Český jazyk – pravopis";
const DRAFT_TITLE = "Český jazyk – pravopis – koncept";
const DIRTY_TITLE_PATTERN = /Defense Screenshot Draft|DiagTest-|Golden Flow|4efeff|vergrergr|vergregr|test123|qwerty/i;

const TEACHER = {
  email: "teacher1@zs.demo.local",
  password: "Password123!",
};

const STUDENT_D = {
  email: "student-d@zs.demo.local",
  password: "Password123!",
};

const STUDENT_A = {
  email: "student-a@zs.demo.local",
  password: "Password123!",
};

type AssignmentSummary = {
  id: string;
  testId: string;
  attemptsUsed: number;
  submissionId: string | null;
};

type TestDetail = {
  id: string;
  title: string;
  questions?: Array<{ id: string; text: string }>;
};

async function ensureScreenshotDir() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function login(page: Page, email: string, password: string) {
  await clearSession(page);
  await page.getByPlaceholder(/you@school\.edu|you@|email/i).fill(email);
  await page.getByPlaceholder(/••••••••|password|heslo/i).fill(password);
  await page.getByRole("button", { name: /sign in|přihlásit/i }).click();
  await page.waitForURL(/\/(app|dashboard|onboarding)/, { timeout: 20_000 });
  await waitForStableUi(page);
}

async function waitForStableUi(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.getByTestId("profile-ready").first().waitFor({ state: "attached", timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function expectVisible(locator: Locator, message: string) {
  const visible = await locator.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!visible) throw new Error(message);
}

async function assertCleanViewport(page: Page, context: string) {
  const dirty = await page.getByText(DIRTY_TITLE_PATTERN).first().isVisible({ timeout: 1000 }).catch(() => false);
  if (dirty) {
    throw new Error(`${context}: ve viewportu je vidět technický testovací název.`);
  }
}

async function screenshot(page: Page, fileName: string) {
  await waitForStableUi(page);
  await assertCleanViewport(page, fileName);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, fileName),
    fullPage: false,
  });
}

async function apiGet<T>(page: Page, pathName: string): Promise<T> {
  const response = await page.request.get(`${BASE_URL}/api${pathName}`);
  if (!response.ok()) {
    throw new Error(`API GET ${pathName} selhalo s HTTP ${response.status()}.`);
  }
  const payload = await response.json();
  const outer = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  return (outer && typeof outer === "object" && "data" in outer ? outer.data : outer) as T;
}

async function openTeacherTests(page: Page) {
  await page.goto(`${BASE_URL}/app/tests`, { waitUntil: "commit" });
  await waitForStableUi(page);
  await expectVisible(
    page.getByRole("heading", { name: /moje testy|testy v organizaci/i }).first(),
    "Nepodařilo se načíst učitelský přehled testů na /app/tests.",
  );
  await expectVisible(
    page.getByText(TEST_TITLE, { exact: true }).first(),
    `Na přehledu testů není vidět seedovaný test "${TEST_TITLE}". Spusť server seed:defense-screenshots.`,
  );
}

async function openDraftEditorFromTeacherList(page: Page) {
  await openTeacherTests(page);
  const title = page.getByText(DRAFT_TITLE, { exact: true }).first();
  await expectVisible(title, `Na přehledu testů není vidět koncept "${DRAFT_TITLE}".`);

  const row = title.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
  await expectVisible(row.getByRole("button", { name: /^upravit$/i }).first(), "U konceptu není vidět tlačítko Upravit.");
  await row.getByRole("button", { name: /^upravit$/i }).first().click();
  await page.waitForURL(/\/app\/tests\/[0-9a-f-]{36}\/edit/i, { timeout: 15_000 });
  await waitForStableUi(page);

  await expectVisible(page.getByRole("heading", { name: /upravit test/i }), "Nepodařilo se otevřít editaci testu.");
  await expectVisible(page.locator(`input[value="${DRAFT_TITLE}"]`).first(), "V editaci není vidět název konceptu.");
  await expectVisible(page.getByText("Slovo vyjmenované po B je?").first(), "V editaci není vidět první otázka.");
  await expectVisible(page.getByText("Doplň i/y: Děti se smál_.").first(), "V editaci není vidět druhá otázka.");
  await expectVisible(page.getByText("Tvrzení: Slovo slyšet patří mezi vyjmenovaná slova po S.").first(), "V editaci není vidět třetí otázka.");
}

async function findDefenseAssignment(page: Page, requireOpenAttempt: boolean): Promise<AssignmentSummary> {
  const assignments = await apiGet<AssignmentSummary[]>(page, "/assignments/my");
  for (const assignment of assignments) {
    const testDetail = await apiGet<TestDetail>(page, `/tests/${assignment.testId}`).catch(() => null);
    if (testDetail?.title !== TEST_TITLE) continue;
    if (requireOpenAttempt && assignment.submissionId) continue;
    return assignment;
  }
  throw new Error(`Student nemá dostupné zadání pro test "${TEST_TITLE}". Spusť server seed:defense-screenshots.`);
}

async function openStudentAssignment(page: Page) {
  await page.goto(`${BASE_URL}/app/assignments`, { waitUntil: "commit" });
  await waitForStableUi(page);
  await expectVisible(
    page.getByRole("heading", { name: /moje zadání/i }),
    "Nepodařilo se načíst studentský seznam zadání na /app/assignments.",
  );

  const assignment = await findDefenseAssignment(page, true);
  await page.goto(`${BASE_URL}/app/assignments/${assignment.id}`, { waitUntil: "commit" });
  await waitForStableUi(page);

  const startButton = page.getByRole("button", { name: /začít pokus/i }).first();
  if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await startButton.click();
    await page.getByText(/Pokus byl vytvořen/i).waitFor({ state: "visible", timeout: 10_000 });
  }

  await expectVisible(page.getByRole("heading", { name: TEST_TITLE }).first(), "Na stránce zadání není vidět název testu.");
  await expectVisible(page.getByText("Slovo vyjmenované po B je?").first(), "Na stránce zadání není vidět první otázka.");
  await expectVisible(page.getByText("být", { exact: true }).first(), "Na stránce zadání není vidět možnost odpovědi.");
}

async function answerAndFinishDefenseAttempt(page: Page): Promise<boolean> {
  await page.getByRole("radio", { name: "být" }).check();
  await page.getByPlaceholder(/napiš odpověď/i).fill("i");
  await page.getByRole("radio", { name: "Ano" }).check();

  const finishButton = page.getByRole("button", { name: /dokončit/i }).first();
  await expectVisible(finishButton, "Na stránce zadání není vidět tlačítko Dokončit.");
  await finishButton.click();
  await page.getByText(/Pokus byl odevzdán|Skóre|2 \/ 3/i).waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  await waitForStableUi(page);

  return await page.getByText(/2 \/ 3|Skóre/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
}

async function openExistingResultForStudentA(page: Page) {
  await login(page, STUDENT_A.email, STUDENT_A.password);
  const assignment = await findDefenseAssignment(page, false);
  if (!assignment.submissionId) {
    throw new Error(`Fallback student-a nemá hotový výsledek pro test "${TEST_TITLE}".`);
  }
  await page.goto(`${BASE_URL}/app/results/${assignment.submissionId}`, { waitUntil: "commit" });
  await page.waitForURL(/\/app\/results\/[0-9a-f-]{36}/i, { timeout: 15_000 });
  await waitForStableUi(page);
}

test.describe("defense screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test("captures real SkillStorm defense screenshots", async ({ page }) => {
    await ensureScreenshotDir();

    await login(page, TEACHER.email, TEACHER.password);
    await openTeacherTests(page);
    await expectVisible(page.getByText(/Zobrazit|Přiřadit|Publikovat|Upravit/i).first(), "V přehledu testů nejsou vidět akce.");
    await screenshot(page, "teacher-tests.png");

    await openDraftEditorFromTeacherList(page);
    await screenshot(page, "teacher-test-edit.png");

    await login(page, STUDENT_D.email, STUDENT_D.password);
    await openStudentAssignment(page);
    await screenshot(page, "student-assignment.png");

    const finishedWithStudentD = await answerAndFinishDefenseAttempt(page);
    if (!finishedWithStudentD) {
      await openExistingResultForStudentA(page);
    }

    await expectVisible(
      page.getByText(TEST_TITLE, { exact: true }).first(),
      "Na výsledku není vidět název testu.",
    );
    await expectVisible(
      page.getByText(/Skóre/i).first(),
      "Na výsledku není vidět skóre.",
    );
    await expectVisible(
      page.getByText(/2 \/ 3|APPROVED|Pokus byl odevzdán|vyhodnocen/i).first(),
      "Na výsledku není vidět vyhodnocený stav nebo skóre 2/3.",
    );
    await screenshot(page, "student-result.png");
  });
});
