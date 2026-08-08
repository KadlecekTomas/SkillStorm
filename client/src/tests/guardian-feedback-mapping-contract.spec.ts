import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd().endsWith("/client") ? process.cwd() : join(process.cwd(), "client");
const source = readFileSync(join(ROOT, "src/hooks/use-guardian.ts"), "utf8");

describe("guardian assessment feedback mapping", () => {
  it("keeps teacher feedback attached to grade and competency timeline events", () => {
    expect(source).toContain('item.kind === "GRADE"');
    expect(source).toContain('item.kind === "COMPETENCY"');
    expect(source).toContain("Boolean(item.detail?.trim())");
  });

  it("normalizes assessment feedback into the parent message surface", () => {
    expect(source).toContain('item.kind === "PRAISE" ? ("PRAISE" as const) : ("COMMENT" as const)');
    expect(source).toContain('? item.title');
    expect(source).toContain("body: item.detail");
    expect(source).toContain("authorName: item.authorName");
  });
});
