import { test, expect } from "@playwright/test";

test("API health responds", async ({ request }) => {
  const response = await request.get("http://localhost:4200/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body?.status ?? "").toMatch(/ok/i);
});
