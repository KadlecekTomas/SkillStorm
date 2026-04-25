/**
 * seeded-core-flow.spec.ts
 *
 * Full E2E integration test using seeded demo accounts.
 * Every critical step has a hard expect() assertion.
 * A test that cannot fail is not a test.
 *
 * Accounts (Password123!):
 *   teacher: teacher1@zs.demo.local
 *   student: student-a@zs.demo.local
 *
 * Flow:
 *   1. Teacher logs in
 *   2. Teacher creates test (title + subject + grade matching student's class)
 *   3. Teacher adds 2 TRUE_FALSE questions (Q1 correct=true, Q2 correct=false)
 *   4. Teacher publishes test via UI → API confirms status=PUBLISHED
 *   5. Teacher assigns test to student's class via UI modal
 *   6. Student logs in and sees OUR assignment in their list
 *   7. Student submits (Q1=true correct, Q2=true wrong → 50%)
 *   8. API confirms submission exists with score ≈ 50%
 *   9. Risk endpoint returns classroom data with students array
 */

import { test, expect, type Page } from "@playwright/test";

// ─── Credentials ─────────────────────────────────────────────────────────────

const TEACHER_EMAIL = "teacher1@zs.demo.local";
const STUDENT_EMAIL = "student-a@zs.demo.local";
const PASSWORD      = "Password123!";
const TEST_TITLE    = `DiagTest-${Date.now()}`;

type ClassSubjectItem = {
  id: string;
  subject: {
    id: string;
    name?: string | null;
  };
};

type TopicLevelItem = {
  id: string;
  name?: string | null;
  catalogTopic?: {
    id?: string | null;
    name?: string | null;
  } | null;
  subjectLevel?: {
    grade?: string | null;
  } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Unwrap the standard API envelope: { success, data: T } or { success, data: { data: T[], meta } }
 */
function unwrap<T = unknown>(json: unknown): T {
  if (json == null || typeof json !== "object") return json as T;
  const outer = (json as Record<string, unknown>).data;
  if (outer === undefined) return json as T;
  if (typeof outer !== "object" || outer === null) return outer as T;
  const inner = (outer as Record<string, unknown>).data;
  if (inner !== undefined) return inner as T;
  return outer as T;
}

async function apiPost(page: Page, path: string, body: unknown) {
  const resp = await page.request.post(`/api${path}`, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  const json = await resp.json().catch(() => null);
  return { status: resp.status(), ok: resp.ok(), json };
}

async function apiGet(page: Page, path: string) {
  const resp = await page.request.get(`/api${path}`);
  const json = await resp.json().catch(() => null);
  return { status: resp.status(), ok: resp.ok(), json };
}

function datetimeLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function chooseTopicForGrade(topics: TopicLevelItem[], grade: string): TopicLevelItem | null {
  const exact = topics.find((topic) => topic.catalogTopic?.id && topic.subjectLevel?.grade === grade);
  if (exact) return exact;
  const fallback = topics.find((topic) => topic.catalogTopic?.id);
  return fallback ?? null;
}

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const emailInput = page.getByPlaceholder(/you@school\.edu/i);
  await expect(emailInput, `login form must be visible for ${email}`).toBeVisible({ timeout: 8000 });

  await emailInput.fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Přihlásit/i }).click();

  // Wait for redirect away from /login
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  } catch {
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error(`Login failed for ${email} — still on login page after 15s. Hint: ${body.slice(0, 200)}`);
  }
  expect(page.url()).not.toContain("/login");
  console.log(`[auth] logged in as ${email}`);
}

// ─── Main test ───────────────────────────────────────────────────────────────

test("seeded-core-flow: teacher → publish → assign → student → score → risk", async ({ page }) => {
  test.setTimeout(180_000);

  let testId: string;
  let classSectionId: string;
  let assignmentId: string | null = null;

  // ── Step 1: Teacher login ─────────────────────────────────────────────────
  console.log("\n── Step 1: Teacher login ──");
  await loginAs(page, TEACHER_EMAIL);

  // ── Step 2: Discover student's class, then create test ───────────────────
  // We log in as student to discover which class they are enrolled in via their
  // existing assignments (GET /assignments/my returns classSectionId per assignment).
  // Then we use that grade/class when creating the test.
  console.log("\n── Step 2: Discover student class & create test ──");

  // 2a: Login as student to discover their enrolled class via existing assignments
  await loginAs(page, STUDENT_EMAIL);
  const studentMyAssignResp = await apiGet(page, "/assignments/my");
  expect(studentMyAssignResp.status, "student GET /assignments/my must return 200").toBe(200);
  const studentMyAssignments = (() => {
    const u = unwrap(studentMyAssignResp.json);
    return Array.isArray(u) ? u as Array<{ id: string; classSectionId?: string | null }> : [];
  })();
  // Find first assignment that has a classSectionId (class-targeted)
  const seededAssignment = studentMyAssignments.find((a) => a.classSectionId != null);
  expect(
    seededAssignment,
    `Student must have at least one class-targeted seeded assignment to discover their enrolled class. ` +
    `Got ${studentMyAssignments.length} assignments. ` +
    `If this fails, the seeded data is missing student class enrollments.`,
  ).toBeDefined();
  classSectionId = seededAssignment!.classSectionId!;
  console.log(`[create] student enrolled class (from seeded assignment): ${classSectionId}`);

  // Discover the grade for this class section
  const classDetailResp = await apiGet(page, `/class-sections/${classSectionId}`);
  const studentGrade: string = (() => {
    if (classDetailResp.status === 200) {
      const cd = unwrap<{ grade?: string | null; label?: string | null }>(classDetailResp.json);
      if (cd?.grade) {
        console.log(`[create] class grade: ${cd.grade} (${cd.label ?? classSectionId})`);
        return cd.grade;
      }
    }
    // Fallback: use GRADE_6 (most common for demo schools)
    console.warn(`[create] could not fetch class grade — using GRADE_6 fallback`);
    return "GRADE_6";
  })();

  // 2b: Back to teacher session
  await loginAs(page, TEACHER_EMAIL);

  // 2c: Discover a subject enabled for the student's class.
  const classSubjectsResp = await apiGet(page, `/class-sections/${classSectionId}/org-subjects`);
  expect(classSubjectsResp.status, "GET /class-sections/:id/org-subjects must return 200").toBe(200);
  const classSubjects = (() => {
    const u = unwrap(classSubjectsResp.json);
    return Array.isArray(u) ? u as ClassSubjectItem[] : [];
  })();
  expect(classSubjects.length, "student class must expose at least one enabled subject").toBeGreaterThan(0);
  const selectedSubject = classSubjects[0]!;
  const subjectId = selectedSubject.subject.id;
  console.log(`[create] subject: ${subjectId} (${selectedSubject.subject.name ?? "?"})`);

  // 2d: Discover a topic so the test is publishable under current business rules.
  const subjectTopicsResp = await apiGet(page, `/topics/by-subject/${subjectId}`);
  expect(subjectTopicsResp.status, "GET /topics/by-subject/:subjectId must return 200").toBe(200);
  const subjectTopics = (() => {
    const u = unwrap(subjectTopicsResp.json);
    return Array.isArray(u) ? u as TopicLevelItem[] : [];
  })();
  const selectedTopic = chooseTopicForGrade(subjectTopics, studentGrade);
  expect(
    selectedTopic,
    `subject ${subjectId} must expose at least one topic with catalogTopic for class grade ${studentGrade}`,
  ).toBeTruthy();
  expect(selectedTopic?.catalogTopic?.id, "selected topic must expose catalogTopicId").toBeTruthy();
  console.log(
    `[create] topic: ${selectedTopic!.catalogTopic!.id} (${selectedTopic!.catalogTopic!.name ?? selectedTopic!.name ?? "?"})`,
  );

  // 2e: Create test — include student's grade and topic assignment metadata.
  const createResp = await apiPost(page, "/tests", {
    title: TEST_TITLE,
    subjectId,
    allowedGrades: [studentGrade],
    catalogTopicId: selectedTopic!.catalogTopic!.id,
  });
  expect(createResp.status, `POST /tests must succeed (got ${createResp.status}: ${JSON.stringify(createResp.json).slice(0, 200)})`).toBeLessThan(300);
  testId = unwrap<{ id?: string }>(createResp.json)?.id ?? "";
  expect(testId, "test creation must return an id").toBeTruthy();
  console.log(`[create] testId=${testId}`);

  // ── Step 3: Add 2 questions ───────────────────────────────────────────────
  // Q1: correct=true  → student answers true  → correct
  // Q2: correct=false → student answers true  → wrong
  // Expected score: 1/2 = 50%
  console.log("\n── Step 3: Add questions ──");

  const q1 = await apiPost(page, `/tests/${testId}/questions`, {
    text: "Je voda mokrá?",
    type: "TRUE_FALSE",
    correctAnswer: "true",
    score: 1,
  });
  expect(q1.status, `Q1 create must succeed (got ${q1.status})`).toBeLessThan(300);
  const q1Id = unwrap<{ id?: string }>(q1.json)?.id;
  expect(q1Id, "Q1 must have an id").toBeTruthy();
  console.log(`[questions] Q1=${q1Id}`);

  const q2 = await apiPost(page, `/tests/${testId}/questions`, {
    text: "Je Slunce studené?",
    type: "TRUE_FALSE",
    correctAnswer: "false",
    score: 1,
  });
  expect(q2.status, `Q2 create must succeed (got ${q2.status})`).toBeLessThan(300);
  const q2Id = unwrap<{ id?: string }>(q2.json)?.id;
  expect(q2Id, "Q2 must have an id").toBeTruthy();
  console.log(`[questions] Q2=${q2Id}`);

  // ── Step 4: Publish test via UI ───────────────────────────────────────────
  console.log("\n── Step 4: Publish ──");
  await page.goto(`/app/tests/${testId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const publishBtn = page.getByRole("button", { name: /Publikovat/i }).first();
  await expect(publishBtn, "Publish button must be visible on test detail page").toBeVisible({ timeout: 10_000 });
  await publishBtn.click();

  // Wait for UI confirmation
  const publishedText = page.getByText(/Publikováno/i).first();
  await expect(publishedText, "UI must show 'Publikováno' after clicking publish").toBeVisible({ timeout: 12_000 });

  // Hard-verify via API
  const testDetailResp = await apiGet(page, `/tests/${testId}`);
  expect(testDetailResp.status, "GET /tests/:id must return 200").toBe(200);
  const testStatus = unwrap<{ status?: string }>(testDetailResp.json)?.status;
  expect(testStatus, "API must confirm test is PUBLISHED").toBe("PUBLISHED");
  console.log(`[publish] confirmed PUBLISHED`);

  // ── Step 5: Assign test to student's class via UI modal ───────────────────
  console.log("\n── Step 5: Assign ──");
  await page.goto(`/app/tests/${testId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const assignBtn = page.getByRole("button", { name: /Přiřadit třídě|Přiřadit/i }).first();
  await expect(assignBtn, "Assign button must be visible after publish").toBeVisible({ timeout: 10_000 });
  await assignBtn.click();

  await expect(page.locator('[role="dialog"]'), "Assign modal must open").toBeVisible({ timeout: 6000 });

  const classSelect = page.locator("#assign-class");
  await expect(classSelect, "#assign-class select must be present in modal").toBeVisible({ timeout: 5000 });
  await classSelect.selectOption(classSectionId, { timeout: 8000 });
  console.log(`[assign] class selected: ${classSectionId}`);

  const openAt = datetimeLocal(0);
  const closeAt = datetimeLocal(240);
  await page.locator("#assign-open").fill(openAt);
  await page.locator("#assign-close").fill(closeAt);

  const submitAssignBtn = page.getByRole("button", { name: /^Přiřadit$|^Přiřazuji/i });
  await submitAssignBtn.click();

  // Modal must close — if it stays open there was a server error
  await expect(
    page.locator('[role="dialog"]'),
    "Assign modal must close after submit (if it stays open, backend rejected the assignment)",
  ).toBeHidden({ timeout: 10_000 });
  console.log(`[assign] modal closed`);

  // Verify assignment exists — use GET /assignments/my (teacher scope) to find it
  // We try multiple times for eventual consistency (modal close → DB write → API)
  let assignmentFound = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const aResp = await apiGet(page, "/assignments/my");
    if (aResp.status === 200) {
      const u = unwrap(aResp.json);
      const list = Array.isArray(u) ? u as Array<{ id: string; testId?: string; classSectionId?: string | null }> : [];
      const match = list.find((a) => a.testId === testId && a.classSectionId === classSectionId);
      if (match) {
        assignmentId = match.id;
        assignmentFound = true;
        console.log(`[assign] assignment confirmed in DB: ${assignmentId}`);
        break;
      }
    }
    await page.waitForTimeout(500);
  }
  expect(assignmentFound, `Assignment for testId=${testId} must exist in DB after modal closed. classSectionId=${classSectionId}`).toBe(true);
  expect(assignmentId, "assignmentId must be captured after assignment creation").toBeTruthy();

  // ── Step 6: Student login + find OUR assignment ───────────────────────────
  console.log("\n── Step 6: Student login ──");
  await loginAs(page, STUDENT_EMAIL);

  // Student must see OUR specific assignment
  const studentAssignmentsResp = await apiGet(page, "/assignments/my");
  expect(studentAssignmentsResp.status, "student GET /assignments/my must return 200").toBe(200);
  const studentAssignments = (() => {
    const u = unwrap(studentAssignmentsResp.json);
    return Array.isArray(u) ? u as Array<{ id: string; testId?: string; test?: { title?: string }; classSectionId?: string | null }> : [];
  })();
  const ourAssignment = studentAssignments.find((a) => a.testId === testId || a.test?.title === TEST_TITLE);
  expect(
    ourAssignment,
    `Student must see our assignment (testId=${testId}) in their list. ` +
    `Found ${studentAssignments.length} assignments. ` +
    `Student class=${classSectionId}. ` +
    `If this fails, the student is not enrolled in the assigned class.`,
  ).toBeDefined();
  console.log(`[student] found our assignment: ${ourAssignment!.id}`);

  // ── Step 7: Student submits via direct API ───────────────────────────────
  // Use Playwright API context (page.request) to bypass UI and directly call the server.
  // This isolates scoring from any React state / fetch interception issues.
  console.log("\n── Step 7: Student submits ──");

  // 7a: Create submission
  const createSubResp = await apiPost(page, "/submissions", { assignmentId });
  expect(createSubResp.status, `POST /submissions must succeed (got ${createSubResp.status})`).toBeLessThan(300);
  const submissionId = unwrap<{ id?: string }>(createSubResp.json)?.id;
  expect(submissionId, "Submission ID must be returned").toBeTruthy();
  console.log(`[submit] submissionId=${submissionId}`);

  // 7b: Finish with explicit responses
  // Q1 (correctAnswer="true") → student answers "true" → CORRECT
  // Q2 (correctAnswer="false") → student answers "true" → WRONG
  // Expected: earned=1/2, score=0.5
  const finishResp = await apiPost(page, `/submissions/${submissionId}/finish`, {
    responses: [
      { questionId: q1Id, givenText: "true" },
      { questionId: q2Id, givenText: "true" },
    ],
  });
  expect(finishResp.status, `POST /submissions/:id/finish must succeed (got ${finishResp.status}: ${JSON.stringify(finishResp.json).slice(0, 200)})`).toBeLessThan(300);
  console.log(`[submit] finish raw: ${JSON.stringify(finishResp.json).slice(0, 400)}`);

  type SubmissionResult = {
    id?: string;
    status?: string;
    score?: number | null;
    earnedPoints?: number | null;
    maxPoints?: number | null;
    percentage?: number | null;
  };
  const submission = unwrap<SubmissionResult>(finishResp.json);
  console.log(`[submit] finish response: id=${submission?.id} status=${submission?.status} score=${submission?.score} earned=${submission?.earnedPoints}/${submission?.maxPoints}`);


  // ── Step 8: Score is core business output — must not be null ─────────────
  console.log("\n── Step 8: Score validation ──");

  // Score is returned by the finish endpoint. It must be a number in [0, 1].
  // A null score means the scoring pipeline did not run — this is a hard failure.
  expect(
    submission?.score,
    "Submission exists but score was not computed — scoring pipeline is broken. " +
    `submission.id=${submission?.id} status=${submission?.status} ` +
    `earnedPoints=${submission?.earnedPoints} maxPoints=${submission?.maxPoints}`,
  ).not.toBeNull();

  expect(
    submission?.score,
    "score must be defined (not undefined)",
  ).toBeDefined();

  const score = submission!.score!;
  expect(score, `score must be ≥ 0 (got ${score})`).toBeGreaterThanOrEqual(0);
  expect(score, `score must be ≤ 1 (got ${score})`).toBeLessThanOrEqual(1);

  // earnedPoints and maxPoints must also be present
  expect(
    submission?.earnedPoints,
    "earnedPoints must be defined — scoring pipeline must populate it",
  ).toBeDefined();
  expect(
    submission?.maxPoints,
    "maxPoints must be defined — scoring pipeline must populate it",
  ).toBeDefined();
  expect(
    (submission?.maxPoints ?? 0),
    `maxPoints must be > 0 (got ${submission?.maxPoints})`,
  ).toBeGreaterThan(0);

  // Validate the expected score: Q1 correct (true→true), Q2 wrong (false→true) → 50%
  const pct = Math.round(score * 100);
  console.log(`[score] score=${score} (${pct}%) earnedPoints=${submission!.earnedPoints}/${submission!.maxPoints}`);
  expect(pct, `Score must be approximately 50%: Q1=correct Q2=wrong. Got ${pct}%`).toBeGreaterThanOrEqual(40);
  expect(pct, `Score must be approximately 50%. Got ${pct}%`).toBeLessThanOrEqual(60);

  // Verify assignment reflects the attempt
  const myAssignResp = await apiGet(page, "/assignments/my");
  expect(myAssignResp.status, "student GET /assignments/my must return 200").toBe(200);
  const myAssignList = (() => {
    const u = unwrap(myAssignResp.json);
    return Array.isArray(u)
      ? u as Array<{ id: string; attemptsUsed?: number; submissionStatus?: string | null; effectiveStatus?: string }>
      : [];
  })();
  const myAssign = myAssignList.find((a) => a.id === assignmentId);
  expect(myAssign, `Our assignment must appear in /assignments/my after submission`).toBeDefined();
  expect((myAssign!.attemptsUsed ?? 0), "attemptsUsed must be ≥ 1").toBeGreaterThanOrEqual(1);
  expect(myAssign!.effectiveStatus, "effectiveStatus must reflect submission").toMatch(/SUBMITTED|CLOSED|IN_PROGRESS|NO_ATTEMPTS_LEFT/);
  console.log(`[score] confirmed: attemptsUsed=${myAssign!.attemptsUsed} effectiveStatus=${myAssign!.effectiveStatus}`);

  // Teacher re-login for step 9
  await loginAs(page, TEACHER_EMAIL);

  // ── Step 9: Risk endpoint ─────────────────────────────────────────────────
  console.log("\n── Step 9: Risk endpoint ──");
  const riskResp = await apiGet(page, `/classrooms/${classSectionId}/risk-overview`);
  expect(riskResp.status, `GET /classrooms/${classSectionId}/risk-overview must return 200`).toBe(200);

  const riskData = unwrap<{
    classroomId?: string;
    students?: Array<{ studentId?: string; riskLevel?: string }>;
    riskLevel?: string;
  }>(riskResp.json);

  // Must return either a students array or a top-level riskLevel
  const hasStudents = Array.isArray(riskData?.students);
  const hasRiskLevel = riskData?.riskLevel !== undefined;
  expect(
    hasStudents || hasRiskLevel,
    `Risk endpoint must return students[] or riskLevel. Got keys: ${Object.keys(riskData ?? {}).join(", ")}. Response: ${JSON.stringify(riskData).slice(0, 300)}`,
  ).toBe(true);

  if (hasStudents) {
    const students = riskData!.students!;
    expect(students.length, "Risk classroom must have enrolled students").toBeGreaterThan(0);
    console.log(`[risk] ${students.length} students, riskLevels: ${students.map((s) => s.riskLevel).join(", ")}`);
  } else {
    console.log(`[risk] riskLevel=${riskData?.riskLevel}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
=== TEST RESULT SUMMARY ===

  ✅  login (teacher)      OK
  ✅  create test          OK (testId=${testId})
  ✅  add questions        OK (Q1=${q1Id} Q2=${q2Id})
  ✅  publish              OK (status=PUBLISHED)
  ✅  assign               OK (assignmentId=${assignmentId})
  ✅  login (student)      OK
  ✅  student submit       OK (submissionId=${submissionId})
  ✅  score validation     OK (score=${score} ${pct}% earnedPoints=${submission!.earnedPoints}/${submission!.maxPoints})
  ✅  risk endpoint        OK (students=${hasStudents ? riskData!.students!.length : "n/a"})

===========================
`);
});
