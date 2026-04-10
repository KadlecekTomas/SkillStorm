import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
const PASSWORD = "Password123!";

type Envelope<T> = {
  data?: T;
  message?: string;
  code?: string;
  meta?: {
    code?: string;
  };
};

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function unwrap<T>(json: Envelope<T> | T): T {
  if (json && typeof json === "object" && "data" in (json as Envelope<T>)) {
    return ((json as Envelope<T>).data ?? json) as T;
  }
  return json as T;
}

async function jsonOf<T>(response: { json(): Promise<unknown> }): Promise<T> {
  return unwrap<T>((await response.json()) as Envelope<T>);
}

async function registerIndividual(api: APIRequestContext, tag: string) {
  const email = `${tag}@skillstorm.local`;
  const res = await api.post("/api/auth/register", {
    data: {
      name: `Director ${tag}`,
      email,
      username: tag.slice(0, 24),
      password: PASSWORD,
      mode: "INDIVIDUAL",
    },
  });
  expect(res.ok(), `register failed: ${await res.text()}`).toBeTruthy();
  return { email, password: PASSWORD };
}

async function login(api: APIRequestContext, email: string, password: string) {
  const res = await api.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.ok(), `login failed: ${await res.text()}`).toBeTruthy();
}

async function createOrganization(api: APIRequestContext, name: string) {
  const res = await api.post("/api/organizations", {
    data: { name, type: "SCHOOL" },
  });
  expect(res.status(), await res.text()).toBe(201);
  return jsonOf<{ id: string }>(res);
}

async function switchToOrganization(api: APIRequestContext, orgId: string) {
  const res = await api.post("/api/auth/use-org", {
    data: { orgId },
  });
  expect(res.ok(), `use-org failed: ${await res.text()}`).toBeTruthy();
}

async function createInvite(api: APIRequestContext, role: "TEACHER" | "STUDENT") {
  const res = await api.post("/api/invites", {
    data: { type: "ORG_ONLY", role },
  });
  expect(res.status(), await res.text()).toBe(201);
  const invite = await jsonOf<{ inviteToken?: string; token?: string }>(res);
  const token = invite.inviteToken ?? invite.token;
  expect(token).toBeTruthy();
  return token!;
}

async function registerJoinOrg(tag: string, inviteToken: string) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const email = `${tag}@skillstorm.local`;
  const res = await api.post("/api/auth/register", {
    data: {
      name: tag,
      email,
      username: tag.slice(0, 24),
      password: PASSWORD,
      mode: "JOIN_ORG",
      inviteToken,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  await api.dispose();
  return { email, name: tag };
}

test("classrooms, teachers, and enrollments stay consistent after mutations", async ({ page }) => {
  const directorApi = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const directorTag = unique("director");
  const director = await registerIndividual(directorApi, directorTag);
  const org = await createOrganization(directorApi, unique("consistency-org"));
  await switchToOrganization(directorApi, org.id);

  const teacher = await registerJoinOrg(`Teacher ${unique("consistency")}`, await createInvite(directorApi, "TEACHER"));
  const student = await registerJoinOrg(`Student ${unique("consistency")}`, await createInvite(directorApi, "STUDENT"));

  const studentsRes = await directorApi.get("/api/students", {
    params: { search: student.email, limit: "20" },
  });
  expect(studentsRes.status(), await studentsRes.text()).toBe(200);
  const studentsPayload = await jsonOf<{ data: Array<{ id: string; membership?: { user?: { email?: string | null } } }> } | Array<{ id: string; membership?: { user?: { email?: string | null } } }>>(studentsRes);
  const students = Array.isArray(studentsPayload) ? studentsPayload : studentsPayload.data;
  const createdStudent = students.find((item) => item.membership?.user?.email === student.email);
  expect(createdStudent?.id).toBeTruthy();

  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder(/you@school\.edu|you@|email/i).fill(director.email);
  await page.getByPlaceholder(/••••••••|password/i).fill(director.password);
  await page.getByRole("button", { name: /Sign in|Přihlásit/i }).click();
  await page.waitForURL(/\/(app|dashboard|onboarding)/, { timeout: 15_000 });

  await page.goto(`${BASE_URL}/app/classrooms`, { waitUntil: "networkidle" });

  const classroomLabel = `Consistency ${Date.now()}`;
  await page.getByTestId("create-classroom-btn").click();
  await expect(page.getByText("Nová třída")).toBeVisible();
  await page.getByPlaceholder("A").fill("ZX");
  await page.getByLabel("Název třídy").fill(classroomLabel);
  await page.getByRole("button", { name: /^Vytvořit$/ }).click();

  const classCard = page.locator('button[data-testid^="classroom-item-"]').filter({ hasText: classroomLabel }).first();
  await expect(classCard).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Přidat žáky" }).click();
  await expect(page.getByText("Přidat žáky")).toBeVisible();
  await page.getByLabel(student.name).check();
  await page.getByRole("button", { name: /^Zapsat$/ }).click();

  await expect(classCard).toContainText("1 žáků", { timeout: 10_000 });
  await expect(page.getByText(student.name).first()).toBeVisible({ timeout: 10_000 });

  await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });
  await expect(page.getByText(teacher.name).first()).toBeVisible({ timeout: 10_000 });

  await page.goto(`${BASE_URL}/app/settings/teachers`, { waitUntil: "networkidle" });
  await expect(page.getByText("Teachers")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(teacher.name).first()).toBeVisible({ timeout: 10_000 });

  await directorApi.dispose();
});
