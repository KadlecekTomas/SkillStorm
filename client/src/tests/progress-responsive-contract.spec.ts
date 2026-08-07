import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd().endsWith("/client") ? process.cwd() : join(process.cwd(), "client");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("progress release hardening contracts", () => {
  it("never leaves progress context failure on an infinite spinner", () => {
    const source = read("src/app/(school)/app/progress/page.tsx");
    expect(source).toContain("Pokrok teď nejde načíst");
    expect(source).toContain("Zkusit znovu");
    expect(source).toContain("loadPageData");
  });

  it("uses reactive online/offline state and keeps sync scoped", () => {
    const source = read("src/app/(school)/app/progress/page.tsx");
    expect(source).toContain("function useOnlineStatus(): boolean");
    expect(source).toContain('window.addEventListener("offline", sync)');
    expect(source).toContain("listQueuedProgressEntries(offlineScope)");
  });

  it("does not render attendance or support save as a no-op without a student", () => {
    const source = read("src/app/(school)/app/progress/page.tsx");
    expect(source).toContain("disabled={busy || !selectedStudent} onClick={() => void saveAttendance()}");
    expect(source).toContain("disabled={busy || !selectedStudent || !interventionTitle.trim()} onClick={() => void saveIntervention()}");
    expect(source).toContain("Zadejte počet minut zpoždění jako celé číslo od 1 do 1440.");
  });

  it("renders leadership comparison as mobile cards and desktop table", () => {
    const source = read("src/app/(school)/app/progress/page.tsx");
    expect(source).toContain('className="grid gap-3 md:hidden" aria-label="Srovnání tříd"');
    expect(source).toContain('className="hidden overflow-x-auto rounded-xl border border-line md:block"');
  });

  it("keeps parent primary actions full-width on narrow screens", () => {
    const source = read("src/app/(school)/app/family/page.tsx");
    expect(source).toContain('className="h-11 w-full shrink-0 sm:w-auto"');
    expect(source).toContain('className="h-12 w-full sm:w-auto"');
  });
});
