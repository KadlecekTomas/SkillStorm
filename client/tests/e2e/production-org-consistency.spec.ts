import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

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

function errorCode(json: Envelope<unknown> | Record<string, unknown>): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const envelope = json as Envelope<{ code?: string }>;
  const dataCode =
    envelope.data && typeof envelope.data === "object"
      ? (envelope.data as { code?: string }).code
      : undefined;
  return envelope.code ?? envelope.meta?.code ?? dataCode;
}

async function jsonOf<T>(response: { json(): Promise<unknown> }): Promise<T> {
  return unwrap<T>((await response.json()) as Envelope<T>);
}

async function registerUser(api: APIRequestContext) {
  const tag = unique("org-e2e");
  const email = `${tag}@skillstorm.local`;
  const res = await api.post("/api/auth/register", {
    data: {
      name: `User ${tag}`,
      email,
      username: tag.slice(0, 24),
      password: PASSWORD,
      mode: "INDIVIDUAL",
    },
  });
  expect(res.ok(), `register failed: ${await res.text()}`).toBeTruthy();
  return { email, password: PASSWORD };
}

async function loginUser(api: APIRequestContext, email: string, password: string) {
  const res = await api.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.ok(), `login failed: ${await res.text()}`).toBeTruthy();
}

async function createUserContext() {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const user = await registerUser(api);
  return { api, ...user };
}

async function createOrganization(
  api: APIRequestContext,
  name: string,
  headers?: Record<string, string>,
) {
  return api.post("/api/organizations", {
    data: { name, type: "SCHOOL" },
    ...(headers ? { headers } : {}),
  });
}

async function switchToOrganization(api: APIRequestContext, orgId: string) {
  const res = await api.post("/api/auth/use-org", {
    data: { orgId },
  });
  expect(res.ok(), `use-org failed: ${await res.text()}`).toBeTruthy();
}

test.describe("Production org consistency", () => {
  test("first class creation works for PENDING org and activates the org immediately", async () => {
    const { api } = await createUserContext();
    const orgRes = await createOrganization(api, unique("pending-org"));
    expect(orgRes.status(), await orgRes.text()).toBe(201);
    const org = await jsonOf<{ id: string; status: string }>(orgRes);
    expect(org.status).toBe("PENDING");

    await switchToOrganization(api, org.id);

    const classRes = await api.post("/api/classrooms", {
      data: {
        grade: "GRADE_5",
        section: "A",
        label: "5.A",
      },
    });
    expect(classRes.status(), await classRes.text()).toBe(201);

    const detailRes = await api.get(`/api/organizations/${org.id}`);
    expect(detailRes.status(), await detailRes.text()).toBe(200);
    const detail = await jsonOf<{ status: string }>(detailRes);
    expect(detail.status).toBe("ACTIVE");

    await api.dispose();
  });

  test("PENDING org cannot access non-whitelisted authoring route", async () => {
    const { api } = await createUserContext();
    const orgRes = await createOrganization(api, unique("blocked-org"));
    expect(orgRes.status(), await orgRes.text()).toBe(201);
    const org = await jsonOf<{ id: string }>(orgRes);

    await switchToOrganization(api, org.id);

    const testRes = await api.post("/api/tests", {
      data: {
        title: "Pending org blocked test",
        subjectId: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(testRes.status(), await testRes.text()).toBe(409);
    const body = (await testRes.json()) as Envelope<{ code?: string }>;
    expect(errorCode(body)).toBe("ORG_PENDING");

    await api.dispose();
  });

  test("create-organization is atomic when bootstrap fails inside the transaction", async () => {
    const { api } = await createUserContext();

    const failingRes = await createOrganization(api, unique("atomic-fail"), {
      "x-test-fail-before-academic-year": "1",
    });
    expect(failingRes.status(), await failingRes.text()).toBe(500);

    const retryRes = await createOrganization(api, unique("atomic-retry"));
    expect(retryRes.status(), await retryRes.text()).toBe(201);

    await api.dispose();
  });

  test("same Idempotency-Key returns the same organization on replay", async () => {
    const { api } = await createUserContext();
    const key = unique("idem");
    const name = unique("idem-org");

    const firstRes = await createOrganization(api, name, {
      "Idempotency-Key": key,
    });
    expect(firstRes.status(), await firstRes.text()).toBe(201);
    const firstOrg = await jsonOf<{ id: string }>(firstRes);

    const secondRes = await createOrganization(api, name, {
      "Idempotency-Key": key,
    });
    expect(secondRes.status(), await secondRes.text()).toBe(201);
    const secondOrg = await jsonOf<{ id: string }>(secondRes);

    expect(secondOrg.id).toBe(firstOrg.id);
    await api.dispose();
  });

  test("retry after response failure returns the original org instead of creating a second one", async () => {
    const { api } = await createUserContext();
    const key = unique("retry");
    const name = unique("retry-org");

    const failedResponse = await createOrganization(api, name, {
      "Idempotency-Key": key,
      "x-test-fail-after-commit": "1",
    });
    expect(failedResponse.status(), await failedResponse.text()).toBe(500);

    const replayRes = await createOrganization(api, name, {
      "Idempotency-Key": key,
    });
    expect(replayRes.status(), await replayRes.text()).toBe(201);
    const replayOrg = await jsonOf<{ id: string }>(replayRes);

    const secondCreateRes = await createOrganization(api, unique("retry-second"));
    expect(secondCreateRes.status(), await secondCreateRes.text()).toBe(409);
    const body = (await secondCreateRes.json()) as Envelope<{ code?: string }>;
    expect(errorCode(body)).toBe("ORG_OWNER_LIMIT_REACHED");

    await switchToOrganization(api, replayOrg.id);
    const meRes = await api.get("/api/auth/me");
    expect(meRes.status(), await meRes.text()).toBe(200);
    const me = await jsonOf<{ organization?: { id?: string } | null }>(meRes);
    expect(me.organization?.id).toBe(replayOrg.id);

    await api.dispose();
  });

  test("double-submit with the same idempotency key creates only one organization", async () => {
    const first = await createUserContext();
    const second = await playwrightRequest.newContext({ baseURL: BASE_URL });
    await loginUser(second, first.email, first.password);

    const key = unique("double-submit");
    const name = unique("double-org");

    const [resA, resB] = await Promise.all([
      createOrganization(first.api, name, { "Idempotency-Key": key }),
      createOrganization(second, name, { "Idempotency-Key": key }),
    ]);

    expect(resA.status(), await resA.text()).toBe(201);
    expect(resB.status(), await resB.text()).toBe(201);

    const orgA = await jsonOf<{ id: string }>(resA);
    const orgB = await jsonOf<{ id: string }>(resB);
    expect(orgA.id).toBe(orgB.id);

    await first.api.dispose();
    await second.dispose();
  });

  test("organization still exists when create succeeds and switch-org later fails", async () => {
    const { api } = await createUserContext();
    const orgRes = await createOrganization(api, unique("switch-fail-org"));
    expect(orgRes.status(), await orgRes.text()).toBe(201);
    const org = await jsonOf<{ id: string }>(orgRes);

    const switchRes = await api.post("/api/auth/use-org", {
      data: { orgId: "00000000-0000-0000-0000-000000000099" },
    });
    expect(switchRes.ok()).toBeFalsy();

    const meRes = await api.get("/api/auth/me");
    expect(meRes.status(), await meRes.text()).toBe(200);
    const me = await jsonOf<{ organization?: { id?: string | null } | null }>(meRes);
    expect(me.organization?.id).toBe(org.id);

    await api.dispose();
  });
});
