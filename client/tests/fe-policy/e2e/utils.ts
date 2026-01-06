import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __MSW_READY__?: boolean;
    __MSW_RESET__?: () => Promise<void> | void;
    __MSW_EXPIRE__?: () => Promise<void> | void;
    __MSW_AUDIT__?: () => Promise<unknown[]> | unknown[];
  }
}

export const waitForProfile = async (page: Page) => {
  await page.waitForSelector('[data-testid="profile-ready"]', {
    state: "attached",
    timeout: 5000,
  });
};

export const loginAs = async (
  page: Page,
  email: string,
  password = "password",
) => {
  await page.goto("/login");
  await page.fill('input[placeholder="you@school.edu"]', email);
  await page.fill('input[placeholder="••••••••"]', password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard**");
  await waitForProfile(page);
};

export const resetTestingState = async (page: Page) => {
  await page.goto("/login");
  await page.waitForFunction(() => window.__MSW_READY__ === true);
  await page.evaluate(async () => {
    if (typeof window.__MSW_RESET__ === "function") {
      await window.__MSW_RESET__();
    }
  });
};

export const callTestingEndpoint = async (
  page: Page,
  path: string,
  options?: { method?: string },
) => {
  await page.evaluate(
    async ({ endpoint, method }) => {
      if (endpoint === "/testing/expire-token") {
        if (typeof window.__MSW_EXPIRE__ === "function") {
          await window.__MSW_EXPIRE__();
        }
        return;
      }
      if (endpoint === "/testing/reset") {
        if (typeof window.__MSW_RESET__ === "function") {
          await window.__MSW_RESET__();
        }
        return;
      }
      await fetch(endpoint, { method: method ?? "POST" });
    },
    { endpoint: path, method: options?.method },
  );
};

export const getAuditLog = async (page: Page) => {
  return page.evaluate(async () => {
    if (typeof window.__MSW_AUDIT__ === "function") {
      const audit = await window.__MSW_AUDIT__();
      return { events: Array.isArray(audit) ? audit : [] };
    }
    return { events: [] };
  });
};

export const waitForLibraryReady = async (page: Page) => {
  await page.waitForSelector('[data-testid="library-loaded"]', {
    state: "attached",
    timeout: 7000,
  });
};

export const waitForSubmissionReady = async (page: Page) => {
  await page.waitForSelector('[data-testid="submission-ready"]', {
    state: "attached",
    timeout: 7000,
  });
};
