import "@testing-library/jest-dom/vitest";
import "whatwg-fetch";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";
import { queryClient } from "@/lib/query-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/mock-path",
  useSearchParams: () => new URLSearchParams(),
  useParams: vi.fn(() => ({})),
}));

vi.mock("@/lib/audit/audit.client", () => ({
  audit: vi.fn(),
  flushAuditQueue: vi.fn(async () => true),
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
