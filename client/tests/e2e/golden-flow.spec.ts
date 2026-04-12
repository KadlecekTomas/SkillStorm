/**
 * This test guarantees:
 * - test creation persists correctly
 * - assignment is linked to class
 * - submission stores correct responses
 * - scoring is correct
 * - RBAC prevents unauthorized actions
 */
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Password123!";
const TEACHER_EMAIL = "teacher1@zs.demo.local";
const STUDENT_EMAIL = "student-d@zs.demo.local";
const TITLE_SUFFIX = new Date().toISOString().replace(/[-:.TZ]/g, "");

const GOLDEN = {
  testTitle: `Golden Flow ${TITLE_SUFFIX}`,
  testDescription: "Public API + UI deterministic end-to-end verification",
  questionOneText: "Je 1 < 2?",
  questionTwoText: "Kolik je 2 + 2?",
  questionTwoCorrectAnswer: "4",
  questionTwoIncorrectAnswer: "5",
} as const;

type ClassSectionItem = {
  id: string;
  label?: string | null;
  grade: string;
  section?: string | null;
};

type OrgSubjectItem = {
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

type CreatedTestPayload = {
  id: string;
  title: string;
};

type TestDetail = {
  id: string;
  title: string;
  status?: string;
  questions?: Array<{ id: string; text?: string | null }>;
  assignments?: Array<{ id: string; topicLevelId: string; isPrimary: boolean }>;
};

type AssignmentOverviewItem = {
  id: string;
  testId: string;
  classSectionId: string | null;
  effectiveStatus?: string;
  attemptNo: number;
  attemptsUsed: number;
  submittedAt: string | null;
  submissionStatus: string | null;
};

type SubmissionListItem = {
  id: string;
  assignmentId: string;
  status: string;
  student?: {
    id: string;
    name: string | null;
  } | null;
  score: number | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  percentage: number | null;
  attemptNo: number;
  submittedAt: string | null;
};

type SubmissionDetail = {
  id: string;
  assignmentId: string | null;
  status: string;
  score: number | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  percentage: number | null;
  submittedAt: string | null;
  attemptNo: number;
  responses?: Array<{
    questionId: string;
    givenText: string;
    isCorrect: boolean | null;
  }>;
};

type AuthMe = {
  id: string;
  name?: string | null;
  email?: string | null;
};

type RiskOverviewStudent = {
  studentId: string;
  displayName: string;
  averageScorePercent: number;
  lastActivityAt: string | null;
  trend: "UP" | "DOWN" | "STABLE";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskFlags: Array<"LOW_AVERAGE" | "INACTIVE" | "DECLINING">;
};

type ClassroomRiskOverview = {
  classroomId: string;
  students: RiskOverviewStudent[];
};

function unwrapEnvelope<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const outer = (payload as { data: unknown }).data;
    if (outer && typeof outer === "object" && "data" in outer) {
      return (outer as { data: T }).data;
    }
    return outer as T;
  }
  return payload as T;
}

async function loginUi(page: Page, email: string): Promise<void> {
  await page.goto("/login", { waitUntil: "commit" });
  await page.getByPlaceholder(/you@school\.edu/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|přihlásit/i }).click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  console.log("Current URL after login:", page.url());
  await expect(page).not.toHaveURL(/\/login\/?$/i, { timeout: 15_000 });
  await expect(page.getByTestId("profile-ready").first()).toBeAttached({
    timeout: 15_000,
  });
}

async function newLoggedInPage(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginUi(page, email);
  return { context, page };
}

async function csrfTokenFor(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies(BASE_URL);
  const csrf = cookies.find((cookie) => cookie.name === "ss_csrf")?.value;
  expect(csrf, "csrf cookie should exist after browser login").toBeTruthy();
  return csrf!;
}

async function jsonFromPageRequest<T>(
  page: Page,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options?: { data?: unknown; headers?: Record<string, string> },
): Promise<{ status: number; body: T }> {
  const requestOptions = options?.headers ? { headers: options.headers } : {};
  const mutationOptions = {
    ...(options?.data !== undefined ? { data: options.data } : {}),
    ...(options?.headers ? { headers: options.headers } : {}),
  };
  const response =
    method === "GET"
      ? await page.request.get(path, requestOptions)
      : method === "PATCH"
        ? await page.request.patch(path, mutationOptions)
        : await page.request.post(path, mutationOptions);

  return {
    status: response.status(),
    body: unwrapEnvelope<T>(await response.json()),
  };
}

function isoNowOffset(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

function chooseTopicForGrade(topics: TopicLevelItem[], grade: string): TopicLevelItem | null {
  const exact = topics.find((topic) => topic.catalogTopic?.id && topic.subjectLevel?.grade === grade);
  if (exact) return exact;
  const fallback = topics.find((topic) => topic.catalogTopic?.id);
  return fallback ?? null;
}

test.describe("golden flow", () => {
  test.describe.configure({ timeout: 120_000 });

  test("proves the core teacher -> assign -> student -> score -> RBAC workflow", async ({ browser }) => {
    let teacherContext: BrowserContext | null = null;
    let studentContext: BrowserContext | null = null;

    try {
      const teacherSession = await newLoggedInPage(browser, TEACHER_EMAIL);
      teacherContext = teacherSession.context;
      const teacherPage = teacherSession.page;
      const teacherCsrf = await csrfTokenFor(teacherContext);

      const studentSession = await newLoggedInPage(browser, STUDENT_EMAIL);
      studentContext = studentSession.context;
      const studentPage = studentSession.page;
      const studentCsrf = await csrfTokenFor(studentContext);

      const studentAssignmentsSeedResponse = await jsonFromPageRequest<AssignmentOverviewItem[]>(
        studentPage,
        "GET",
        "/api/assignments/my",
      );
      expect(studentAssignmentsSeedResponse.status).toBe(200);
      const studentClassIds = new Set(
        studentAssignmentsSeedResponse.body
          .map((item) => item.classSectionId)
          .filter((id): id is string => Boolean(id)),
      );

      const studentMeResponse = await jsonFromPageRequest<AuthMe>(
        studentPage,
        "GET",
        "/api/auth/me",
      );
      expect(studentMeResponse.status).toBe(200);
      const studentName = studentMeResponse.body.name?.trim() ?? STUDENT_EMAIL;
      console.log("Resolved student name:", studentName);

      const classSectionsResponse = await jsonFromPageRequest<ClassSectionItem[]>(
        teacherPage,
        "GET",
        "/api/class-sections",
      );
      expect(classSectionsResponse.status).toBe(200);
      expect(classSectionsResponse.body.length, "seeded demo data must expose at least one class section").toBeGreaterThan(0);
      const selectedClass =
        classSectionsResponse.body.find((item) => studentClassIds.has(item.id)) ??
        classSectionsResponse.body[0]!;

      const classSubjectsResponse = await jsonFromPageRequest<OrgSubjectItem[]>(
        teacherPage,
        "GET",
        `/api/class-sections/${selectedClass.id}/org-subjects`,
      );
      expect(classSubjectsResponse.status).toBe(200);
      expect(classSubjectsResponse.body.length, "selected class must have at least one enabled subject").toBeGreaterThan(0);
      const selectedSubject = classSubjectsResponse.body[0]!;

      const subjectTopicsResponse = await jsonFromPageRequest<TopicLevelItem[]>(
        teacherPage,
        "GET",
        `/api/topics/by-subject/${selectedSubject.subject.id}`,
      );
      expect(subjectTopicsResponse.status).toBe(200);
      const selectedTopic = chooseTopicForGrade(subjectTopicsResponse.body, selectedClass.grade);
      expect(selectedTopic, `subject ${selectedSubject.subject.id} must expose at least one topic with catalogTopic for class grade ${selectedClass.grade}`).toBeTruthy();
      expect(selectedTopic?.catalogTopic?.id).toBeTruthy();

      const createTestResponse = await jsonFromPageRequest<CreatedTestPayload>(
        teacherPage,
        "POST",
        "/api/tests",
        {
          headers: { "x-csrf-token": teacherCsrf },
          data: {
            title: GOLDEN.testTitle,
            description: GOLDEN.testDescription,
            subjectId: selectedSubject.subject.id,
            catalogTopicId: selectedTopic!.catalogTopic!.id,
            allowedGrades: [selectedClass.grade],
          },
        },
      );
      expect(createTestResponse.status).toBe(201);
      const testId = createTestResponse.body.id;
      expect(testId).toMatch(/^[0-9a-f-]{36}$/);

      const addQuestionOneResponse = await jsonFromPageRequest<Record<string, unknown>>(
        teacherPage,
        "POST",
        `/api/tests/${testId}/questions`,
        {
          headers: { "x-csrf-token": teacherCsrf },
          data: {
            text: GOLDEN.questionOneText,
            type: "TRUE_FALSE",
            order: 1,
            score: 1,
            correctAnswer: "true",
          },
        },
      );
      expect(addQuestionOneResponse.status).toBe(201);

      const addQuestionTwoResponse = await jsonFromPageRequest<Record<string, unknown>>(
        teacherPage,
        "POST",
        `/api/tests/${testId}/questions`,
        {
          headers: { "x-csrf-token": teacherCsrf },
          data: {
            text: GOLDEN.questionTwoText,
            type: "FILL_IN_THE_BLANK",
            order: 2,
            score: 1,
            correctAnswer: GOLDEN.questionTwoCorrectAnswer,
          },
        },
      );
      expect(addQuestionTwoResponse.status).toBe(201);

      await teacherPage.goto(`/app/tests/${testId}`, { waitUntil: "commit" });
      await teacherPage.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 12_000,
      });
      await expect(teacherPage.getByRole("heading", { name: GOLDEN.testTitle })).toBeVisible();
      await expect(teacherPage.getByText(GOLDEN.questionOneText)).toBeVisible();
      await expect(teacherPage.getByText(GOLDEN.questionTwoText)).toBeVisible();

      const createdTestResponse = await jsonFromPageRequest<TestDetail>(
        teacherPage,
        "GET",
        `/api/tests/${testId}`,
      );
      expect(createdTestResponse.status).toBe(200);
      expect(createdTestResponse.body.questions).toHaveLength(2);
      expect(createdTestResponse.body.assignments?.length ?? 0, "catalogTopicId should create at least one topic assignment").toBeGreaterThan(0);

      const publishResponse = await jsonFromPageRequest<Record<string, unknown>>(
        teacherPage,
        "PATCH",
        `/api/tests/${testId}`,
        {
          headers: { "x-csrf-token": teacherCsrf },
          data: { status: "PUBLISHED" },
        },
      );
      expect(publishResponse.status).toBe(200);

      const publishedTestResponse = await jsonFromPageRequest<TestDetail>(
        teacherPage,
        "GET",
        `/api/tests/${testId}`,
      );
      expect(publishedTestResponse.status).toBe(200);
      expect(publishedTestResponse.body.status).toBe("PUBLISHED");

      const assignResponse = await jsonFromPageRequest<Record<string, unknown>>(
        teacherPage,
        "POST",
        `/api/tests/${testId}/assign`,
        {
          headers: { "x-csrf-token": teacherCsrf },
          data: {
            classSectionId: selectedClass.id,
            topicLevelId: selectedTopic!.id,
            openAt: isoNowOffset(-5),
            closeAt: isoNowOffset(24 * 60),
            maxAttempts: 1,
            shuffle: true,
            showExplain: "after_close",
          },
        },
      );
      expect(assignResponse.status).toBe(201);

      const teacherAssignmentsResponse = await jsonFromPageRequest<AssignmentOverviewItem[]>(
        teacherPage,
        "GET",
        "/api/assignments/my",
      );
      expect(teacherAssignmentsResponse.status).toBe(200);
      const assignment = teacherAssignmentsResponse.body.find(
        (item) => item.testId === testId && item.classSectionId === selectedClass.id,
      );
      expect(assignment, "assignment must exist after teacher assign call").toBeTruthy();

      const assignmentOverviewResponse = await jsonFromPageRequest<AssignmentOverviewItem[]>(
        studentPage,
        "GET",
        "/api/assignments/my",
      );
      expect(assignmentOverviewResponse.status).toBe(200);
      const studentAssignment = assignmentOverviewResponse.body.find((item) => item.id === assignment!.id);
      expect(
        studentAssignment,
        `student ${STUDENT_EMAIL} must see the assigned test in seeded class ${selectedClass.label ?? selectedClass.id}`,
      ).toBeTruthy();
      expect(studentAssignment?.effectiveStatus).toBe("OPEN");

      await studentPage.goto(`/app/assignments/${assignment!.id}`, { waitUntil: "commit" });
      await studentPage.waitForSelector('[data-testid="profile-ready"]', {
        state: "attached",
        timeout: 12_000,
      });
      await expect(studentPage.getByRole("heading", { name: GOLDEN.testTitle })).toBeVisible();
      await studentPage.getByRole("button", { name: "Začít pokus" }).click();
      await expect(studentPage.getByText("Submission byla vytvořena. Můžeš vyplnit odpovědi.")).toBeVisible({ timeout: 10_000 });

      await expect.poll(async () => {
        const texts = await studentPage.locator("p.font-medium").allTextContents();
        return texts.filter((text) => text.trim() === GOLDEN.questionOneText || text.trim() === GOLDEN.questionTwoText).length;
      }, {
        message: "student should see exactly two seeded questions",
      }).toBe(2);

      await studentPage.getByRole("radio", { name: "Ano" }).check();
      await studentPage.getByPlaceholder("Napiš odpověď").fill(GOLDEN.questionTwoIncorrectAnswer);
      await studentPage.getByRole("button", { name: "Uložit odpovědi" }).click();
      await expect(studentPage.getByText("Odpovědi byly uloženy.")).toBeVisible({ timeout: 10_000 });
      await studentPage.getByRole("button", { name: "Dokončit" }).click();

      await expect(studentPage.getByText("Submission byla odevzdána.")).toBeVisible({ timeout: 10_000 });
      await expect(studentPage.getByText("Score")).toBeVisible();
      await expect(studentPage.getByText("1 / 2 (50 %)")).toBeVisible();
      await expect(studentPage.getByText("APPROVED")).toBeVisible();

      const submittedAssignmentOverview = await jsonFromPageRequest<AssignmentOverviewItem[]>(
        studentPage,
        "GET",
        "/api/assignments/my",
      );
      expect(submittedAssignmentOverview.status).toBe(200);
      const submittedAssignment = submittedAssignmentOverview.body.find((item) => item.id === assignment!.id);
      expect(submittedAssignment).toBeTruthy();
      expect(submittedAssignment?.effectiveStatus).toBe("SUBMITTED");
      expect(submittedAssignment?.submissionStatus).toBe("APPROVED");
      expect(submittedAssignment?.submittedAt).toBeTruthy();
      expect(submittedAssignment?.attemptNo).toBe(1);

      const submissionListResponse = await jsonFromPageRequest<SubmissionListItem[]>(
        teacherPage,
        "GET",
        `/api/submissions?assignmentId=${assignment!.id}&limit=10`,
      );
      expect(submissionListResponse.status).toBe(200);
      expect(submissionListResponse).toBeDefined();
      expect(submissionListResponse.body).toBeDefined();
      expect(Array.isArray(submissionListResponse.body)).toBe(true);

      console.log("Submission response:", submissionListResponse.body);

      const apiSubmission = submissionListResponse.body.find((item) => item.assignmentId === assignment!.id);

      console.log("Submission payload from API:", apiSubmission);

      expect(apiSubmission).toBeTruthy();
      expect(apiSubmission?.status).toBe("APPROVED");
      expect(apiSubmission?.submittedAt).toBeTruthy();
      expect(apiSubmission?.attemptNo).toBe(1);

      const scoreIsCorrect =
        apiSubmission != null &&
        apiSubmission.score != null &&
        Math.abs(apiSubmission.score - 0.5) <= 0.00001 &&
        apiSubmission.earnedPoints === 1;
      if (!scoreIsCorrect) {
        throw new Error("UI submission does not produce correct scoring");
      }
      expect(apiSubmission?.score).toBeCloseTo(0.5, 5);
      expect(apiSubmission?.earnedPoints).toBe(1);
      expect(apiSubmission?.maxPoints).toBe(2);
      expect(apiSubmission?.percentage).toBe(50);

      const submissionDetailResponse = await jsonFromPageRequest<SubmissionDetail>(
        teacherPage,
        "GET",
        `/api/submissions/${apiSubmission?.id}`,
      );
      expect(submissionDetailResponse.status).toBe(200);
      const submissionDetail = submissionDetailResponse.body;
      expect(submissionDetail.status).toBe("APPROVED");
      expect(submissionDetail.submittedAt).toBeTruthy();
      expect(submissionDetail.attemptNo).toBe(1);
      expect(submissionDetail.assignmentId).toBe(assignment!.id);
      expect(submissionDetail.responses).toHaveLength(2);
      expect(submissionDetail.responses?.filter((response) => response.isCorrect === true)).toHaveLength(1);
      expect(submissionDetail.responses?.filter((response) => response.isCorrect === false)).toHaveLength(1);

      const riskOverviewResponse = await jsonFromPageRequest<ClassroomRiskOverview>(
        teacherPage,
        "GET",
        `/api/classrooms/${selectedClass.id}/risk-overview`,
      );
      expect(riskOverviewResponse.status).toBe(200);
      console.log("Risk overview response:", riskOverviewResponse.body);
      const expectedStudentRiskName = apiSubmission.student?.name?.trim() ?? studentName;
      console.log("Expected student risk name:", expectedStudentRiskName);
      const normalizedStudentName = expectedStudentRiskName
        .normalize("NFC")
        .trim()
        .toLocaleLowerCase();
      const studentRisk = riskOverviewResponse.body.students.find((student) => {
        const displayName = student.displayName?.normalize("NFC").trim().toLocaleLowerCase();
        return displayName === normalizedStudentName;
      });
      expect(studentRisk).toBeTruthy();
      expect(studentRisk?.averageScorePercent).toBeCloseTo(50, 5);
      expect(studentRisk?.riskLevel).toBe("MEDIUM");

      const studentForbiddenResponse = await jsonFromPageRequest<Record<string, unknown>>(
        studentPage,
        "POST",
        "/api/tests",
        {
          headers: { "x-csrf-token": studentCsrf },
          data: {
            title: `${GOLDEN.testTitle} Forbidden`,
            subjectId: selectedSubject.subject.id,
            catalogTopicId: selectedTopic!.catalogTopic!.id,
            allowedGrades: [selectedClass.grade],
          },
        },
      );
      expect(studentForbiddenResponse.status).toBe(403);
    } finally {
      if (teacherContext) await teacherContext.close().catch(() => undefined);
      if (studentContext) await studentContext.close().catch(() => undefined);
    }
  });
});
