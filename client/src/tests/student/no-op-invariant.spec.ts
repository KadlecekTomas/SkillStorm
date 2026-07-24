import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Statický invariant (regrese P1-5): žádné vizuálně aktivní tlačítko bez akce.
 * Zdrojová kontrola je strukturální záruka; níže ji doplňuje render-based test,
 * který ověřuje SKUTEČNÉ vykreslené chování (ne jen absenci řetězce ve zdroji).
 */
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

// Render harness: STUDENT bez CREATE_TEST → v hlavičce nesmí být žádné akční
// tlačítko (zvoneček odstraněn, „Vytvořit“ je za permission gate).
vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { organizationRole: "STUDENT" } }),
}));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => false }),
}));

describe("no-op prvky jsou odstraněné (statická záruka)", () => {
  it("app-header už nerenderuje zvoneček bez notifikačního systému", () => {
    const src = read("src/components/layout/app-header.tsx");
    expect(src).not.toContain("<Bell");
    expect(src).not.toMatch(/import\s*\{[^}]*\bBell\b/);
  });

  it("stránka výsledků nemá no-op tlačítko Export PDF", () => {
    const src = read("src/app/(school)/app/results/page.tsx");
    expect(src).not.toContain("Export PDF");
    expect(src).not.toContain("<Download");
  });

  it("žákovský stub testu už neodkazuje na neexistující /assignments (bez /app)", () => {
    const src = read("src/app/(school)/app/student/tests/[testId]/page.tsx");
    expect(src).not.toMatch(/replace\(`\/assignments\//);
  });
});

describe("no-op prvky jsou odstraněné (skutečný render)", () => {
  it("hlavička žáka nevykreslí žádné akční tlačítko (zvoneček ani skrytý no-op)", () => {
    render(createElement(AppHeader));
    // Žádné <button> se nevykreslí: zvoneček je pryč a „Vytvořit“ je gated.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // Titulek se korektně vykreslí (komponenta funguje, jen bez no-op prvků).
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });
});
