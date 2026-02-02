import { test, expect } from "@playwright/test";

test("API health responds via /api proxy", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body?.status ?? "").toMatch(/ok/i);
});
