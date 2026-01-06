import { test, expect, request as pwRequest } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

test("teacher to student flow (API smoke)", async () => {
  const request = await pwRequest.newContext({ baseURL: BASE_URL });

  // login teacher
  const loginRes = await request.post("/auth/login", {
    data: { email: "teacher@demo.local", password: "Passw0rd!" },
  });
  expect(loginRes.ok()).toBeTruthy();

  // list tests
  const testsRes = await request.get("/tests");
  expect(testsRes.ok()).toBeTruthy();
  const tests = await testsRes.json();
  expect(Array.isArray(tests.data ?? tests)).toBeTruthy();

  // use seeded assignment/submission flow for student
  const studentCtx = await pwRequest.newContext({ baseURL: BASE_URL });
  const studentLogin = await studentCtx.post("/auth/login", {
    data: { email: "student@demo.local", password: "Passw0rd!" },
  });
  expect(studentLogin.ok()).toBeTruthy();
});
