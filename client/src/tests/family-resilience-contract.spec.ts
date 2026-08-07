import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd().endsWith("/client") ? process.cwd() : join(process.cwd(), "client");
const source = readFileSync(join(ROOT, "src/app/(school)/app/family/page.tsx"), "utf8");

describe("family finite error-state contracts", () => {
  it("never turns guardian list or child detail failures into an infinite spinner", () => {
    expect(source).toContain("Rodinný přehled se nepodařilo načíst");
    expect(source).toContain("Údaje dítěte se nepodařilo načíst");
    expect(source.match(/Zkusit znovu/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("shows guardian relation mutation failures instead of swallowing them", () => {
    expect(source).toContain("Potvrzení se nepodařilo uložit");
    expect(source).toContain('role="alert"');
  });
});
