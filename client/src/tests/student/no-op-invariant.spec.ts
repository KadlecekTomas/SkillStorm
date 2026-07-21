import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Statický invariant (regrese P1-5): žádné vizuálně aktivní tlačítko bez akce.
 * Kontrolujeme zdroj, protože jde o strukturální záruku, ne o runtime chování.
 */
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("no-op prvky jsou odstraněné", () => {
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
    // nesmí existovat replace na kořenové /assignments/ bez /app prefixu
    expect(src).not.toMatch(/replace\(`\/assignments\//);
  });
});
