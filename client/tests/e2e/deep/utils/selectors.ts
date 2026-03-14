/**
 * Centralised selectors for deep system tests.
 *
 * Using text / role selectors keeps tests resilient to className churn.
 * data-testid selectors are preferred where they already exist in the codebase.
 */
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth form
// ---------------------------------------------------------------------------

export const authSelectors = {
  emailInput: (page: Page) => page.getByPlaceholder(/you@school\.edu/i),
  passwordInput: (page: Page) => page.getByPlaceholder(/••••••••/i),
  submitBtn: (page: Page) =>
    page.getByRole("button", { name: /Sign in|Přihlásit/i }),
  logoutBtn: (page: Page) => page.getByRole("button", { name: /Odhlásit/i }),
};

// ---------------------------------------------------------------------------
// Tests page
// ---------------------------------------------------------------------------

export const testsPageSelectors = {
  createTestBtn: (page: Page) =>
    page.getByRole("button", { name: /Vytvořit test/i }).first(),
  createTestLink: (page: Page) =>
    page.getByRole("link", { name: /Vytvořit test/i }).first(),
  testHeadingTeacher: (page: Page) => page.getByText("Moje testy"),
  testHeadingDirector: (page: Page) => page.getByText("Testy v organizaci"),
  teacherFilter: (page: Page) => page.locator("#teacher-filter"),
};

// ---------------------------------------------------------------------------
// Create-test form
// ---------------------------------------------------------------------------

export const createTestSelectors = {
  titleInput: (page: Page) =>
    page.getByRole("textbox", { name: /název|title/i }),
  descriptionInput: (page: Page) =>
    page.getByRole("textbox", { name: /popis|description/i }),
  subjectSelect: (page: Page) => page.locator('[id*="subject"], [name*="subject"]').first(),
  saveBtn: (page: Page) =>
    page.getByRole("button", { name: /Uložit|Vytvořit|Save|Create/i }),
  cancelBtn: (page: Page) => page.getByRole("link", { name: /Zrušit/i }),
};

// ---------------------------------------------------------------------------
// Test detail page
// ---------------------------------------------------------------------------

export const testDetailSelectors = {
  addQuestionBtn: (page: Page) =>
    page.getByRole("button", { name: /Přidat otázku|Přidat první otázku/i }),
  publishBtn: (page: Page) =>
    page.getByRole("button", { name: /Publikovat|Dokončit a přiřadit/i }),
  assignBtn: (page: Page) =>
    page.getByRole("button", { name: /Přiřadit třídě|Přiřadit/i }).first(),
  statusBadgeDraft: (page: Page) => page.getByText("Koncept"),
  statusBadgePublished: (page: Page) => page.getByText("Publikováno"),
};

// ---------------------------------------------------------------------------
// Assign-to-class modal
// ---------------------------------------------------------------------------

export const assignModalSelectors = {
  classSelect: (page: Page) => page.locator("#assign-class"),
  openAtInput: (page: Page) => page.locator("#assign-open"),
  closeAtInput: (page: Page) => page.locator("#assign-close"),
  attemptsInput: (page: Page) => page.locator("#assign-attempts"),
  submitBtn: (page: Page) =>
    page.getByRole("button", { name: /^Přiřadit$|^Přiřazuji/i }),
  cancelBtn: (page: Page) => page.getByRole("button", { name: /Zrušit/i }),
};

// ---------------------------------------------------------------------------
// Assignment submission page
// ---------------------------------------------------------------------------

export const submissionSelectors = {
  startBtn: (page: Page) =>
    page.getByRole("button", { name: /Začít pokus/i }),
  saveResponsesBtn: (page: Page) =>
    page.getByRole("button", { name: /Uložit odpovědi/i }),
  finishBtn: (page: Page) =>
    page.getByRole("button", { name: /Dokončit/i }),
  scoreLabel: (page: Page) => page.getByText(/Score/i).locator("..").getByRole("paragraph").last(),
  statusLabel: (page: Page) => page.getByText("Stav").locator("..").getByRole("paragraph").last(),
  submittedAtLabel: (page: Page) => page.getByText(/Odevzdáno:/i),
};

// ---------------------------------------------------------------------------
// Assignments list page
// ---------------------------------------------------------------------------

export const assignmentsListSelectors = {
  openTestBtn: (page: Page) =>
    page.getByRole("button", { name: /Otevřít test/i }).first(),
  emptyState: (page: Page) =>
    page.getByText(/Nemáš žádná aktivní zadání|Žádná zadání/i),
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardSelectors = {
  profileReady: (page: Page) => page.locator('[data-testid="profile-ready"]'),
  noOverview: (page: Page) => page.getByText("Přehled není k dispozici"),
};
