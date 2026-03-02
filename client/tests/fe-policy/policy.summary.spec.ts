import { describe, expect, it } from "vitest";
import { summarizePolicy } from "./fePolicyScore";

describe("FE policy summary", () => {
  it("reports 100% coverage across categories", () => {
    const summary = summarizePolicy();
    const reportLines = summary.map(
      ({ category, passed, total, missing }) =>
        `${category}: ${passed}/${total}${
          missing.length ? ` – missing: ${missing.map((entry) => entry.id).join(", ")}` : ""
        }`,
    );
    // eslint-disable-next-line no-console
    console.log("FE policy summary\n" + reportLines.join("\n"));
    const coveredCategories = summary.filter(({ total }) => total > 0);
    expect(coveredCategories.length, "No FE policy checks were recorded").toBeGreaterThan(0);
    coveredCategories.forEach(({ passed, total, category }) => {
      expect(passed, `${category} has failing cases`).toBe(total);
    });
  });
});
