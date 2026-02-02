import { test, expect, request as pwRequest } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test("teacher to student flow (API smoke)", async () => {
  const request = await pwRequest.newContext({ baseURL: BASE_URL });

  // login teacher (via Next.js proxy /api)
  const loginRes = await request.post("/api/auth/login", {
    data: { email: "teacher@demo.local", password: "Passw0rd!" },
  });
  expect(loginRes.ok()).toBeTruthy();

  // list tests
  const testsRes = await request.get("/api/tests");
  expect(testsRes.ok()).toBeTruthy();
  const tests = await testsRes.json();
  expect(Array.isArray(tests.data ?? tests)).toBeTruthy();

  // use seeded assignment/submission flow for student
  const studentCtx = await pwRequest.newContext({ baseURL: BASE_URL });
  const studentLogin = await studentCtx.post("/api/auth/login", {
    data: { email: "student@demo.local", password: "Passw0rd!" },
  });
  expect(studentLogin.ok()).toBeTruthy();
});
