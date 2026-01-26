import { http, HttpResponse, type JsonBodyType } from "msw";
import {
  login,
  logout,
  refreshSession,
  getProfile,
  switchOrganization,
  registerUser,
  joinOrganization,
  listTests,
  getTest,
  listMaterials,
  listClassrooms,
  logAnalytics,
  getGamificationSummary,
  getAnalyticsSummary,
  createSubmission,
  updateSubmission,
  finishSubmission,
  recordAuditEvents,
  resetMockState,
  expireTokenOnce,
  getAuditEventsSnapshot,
  MockHttpError,
} from "@/mocks/state";

const respond = (factory: () => JsonBodyType) => {
  try {
    const result = factory();
    return HttpResponse.json(result);
  } catch (error) {
    if (error instanceof MockHttpError) {
      return HttpResponse.json(error.body ?? { message: error.message }, {
        status: error.status,
      });
    }
    return HttpResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
};

const MSW_SESSION = "msw-browser";

export const handlers = [

  http.post("*/auth/login", async ({ request }) => {
    const body = (await request.json()) as { login: string; password: string };
    return respond(() => ({
      ...login(body.login, body.password, MSW_SESSION),
      sessionToken: MSW_SESSION,
    }));
  }),

  http.post("*/auth/logout", () => respond(() => {
    logout(MSW_SESSION);
    return { success: true };
  })),

  http.post("*/auth/refresh", () => respond(() => refreshSession(MSW_SESSION))),

  http.get("*/me", () => respond(() => getProfile(MSW_SESSION))),

  http.post("*/auth/use-org", async ({ request }) => {
    const body = (await request.json()) as { orgId: string };
    return respond(() => switchOrganization(body.orgId, MSW_SESSION));
  }),

  http.post("*/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email?: string; name?: string };
    return respond(() => {
      registerUser(body, MSW_SESSION);
      return {
        ...getProfile(MSW_SESSION),
        sessionToken: MSW_SESSION,
      };
    });
  }),

  http.post("*/auth/join", async ({ request }) => {
    const body = (await request.json()) as { joinCode: string; role: string };
    return respond(() => ({
      ...joinOrganization(
        { joinCode: body.joinCode, role: body.role as "STUDENT" | "TEACHER" | "PARENT" },
        MSW_SESSION,
      ),
      sessionToken: MSW_SESSION,
    }));
  }),

  http.get("*/tests", ({ request }) =>
    respond(() => listTests(request.headers.get("x-org-id"), MSW_SESSION)),
  ),

  http.get("*/tests/:testId", ({ request, params }) =>
    respond(() => getTest(params.testId as string, request.headers.get("x-org-id"), MSW_SESSION)),
  ),

  http.get("*/learning-materials", ({ request }) =>
    respond(() => listMaterials(request.headers.get("x-org-id"), MSW_SESSION)),
  ),

  http.get("*/classrooms", ({ request }) =>
    respond(() => listClassrooms(request.headers.get("x-org-id"), MSW_SESSION)),
  ),

  http.get("*/analytics/summary", () => respond(getAnalyticsSummary)),

  http.post("*/analytics/log", () => respond(logAnalytics)),

  http.get("*/gamification/summary/me", () => respond(() => getGamificationSummary(MSW_SESSION))),

  http.post("*/submissions", async ({ request }) => {
    const body = (await request.json()) as { testId: string };
    return respond(() => createSubmission(body.testId, request.headers.get("x-org-id"), MSW_SESSION));
  }),

  http.patch("*/submissions/:submissionId", async ({ request, params }) => {
    const body = (await request.json()) as { answers: Record<string, string> };
    return respond(() =>
      updateSubmission(
        params.submissionId as string,
        request.headers.get("x-org-id"),
        body.answers ?? {},
        MSW_SESSION,
      ),
    );
  }),

  http.post("*/submissions/:submissionId/finish", ({ params, request }) =>
    respond(() => finishSubmission(params.submissionId as string, request.headers.get("x-org-id"), MSW_SESSION)),
  ),

  http.post("*/audit", async ({ request }) => {
    const body = (await request.json()) as { events?: Array<{ action: string; cid: string; ts: number }> };
    return respond(() => recordAuditEvents(body.events ?? []));
  }),

  http.post("*/testing/reset", () => {
    resetMockState();
    return HttpResponse.json({ ok: true });
  }),

  http.post("*/testing/expire-token", ({ request }) => {
    const sessionToken = request.headers.get("x-session-token") ?? MSW_SESSION;
    expireTokenOnce(sessionToken);
    return HttpResponse.json({ ok: true });
  }),

  http.get("*/testing/audit-log", () =>
    HttpResponse.json({ events: getAuditEventsSnapshot() }),
  ),
];
