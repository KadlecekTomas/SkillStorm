import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_ROOT = process.cwd().endsWith("/client")
  ? process.cwd()
  : join(process.cwd(), "client");

function source(relativePath: string): string {
  return readFileSync(join(CLIENT_ROOT, relativePath), "utf8");
}

describe("shared school chrome UX policy", () => {
  it("přepínač školy zobrazuje lidské role a české aria popisky", () => {
    const text = source("src/components/layout/dashboard-header.tsx");
    expect(text).toContain('TEACHER: "Učitel"');
    expect(text).toContain('PARENT: "Rodič"');
    expect(text).toContain('aria-label="Aktivní škola"');
    expect(text).not.toContain("membership.role.toLowerCase()");
  });

  it("support dialog nepoužívá technický jazyk ani neplatné disabled link tlačítko", () => {
    const text = source("src/components/support/report-issue-button.tsx");
    expect(text).toContain("activeRole");
    expect(text).toContain('{ value: "STUDENT", label: "Žák" }');
    expect(text).toContain("Hlášení odešleme podpoře SkillStorm");
    expect(text).not.toContain("Support ticket");
    expect(text).not.toContain("superadminovi");
    expect(text).not.toMatch(/asChild\s+disabled/);
  });

  it("onboarding guardy respektují aktivně zvolenou roli", () => {
    const routeGuard = source("src/components/onboarding/OnboardingRouteGuard.tsx");
    const yearGate = source("src/components/onboarding/AcademicYearGate.tsx");
    for (const text of [routeGuard, yearGate]) {
      expect(text).toContain("activeRole");
      expect(text).toContain("effectiveRole");
    }
  });

  it("onboarding bez školy nevypisuje interní OWNER ani neslibuje ruční volbu role", () => {
    const text = source("src/components/onboarding/NoOrganizationScreen.tsx");
    expect(text).not.toContain("roli OWNER");
    expect(text).not.toContain("vyber svou roli");
    expect(text).toContain("Role se nastaví automaticky");
  });
});
