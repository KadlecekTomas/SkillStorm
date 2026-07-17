import { describe, expect, it } from "vitest";
import {
  formatClassName,
  formatGradeLong,
  formatGradeShort,
  gradeNumber,
} from "@/lib/class-label";

describe("class-label", () => {
  it("parsuje čísla ročníků z enumu", () => {
    expect(gradeNumber("GRADE_2")).toBe(2);
    expect(gradeNumber("HIGH_SCHOOL_YEAR_3")).toBe(3);
    expect(gradeNumber("UNKNOWN")).toBeNull();
  });

  it("formátuje krátkou i dlouhou podobu", () => {
    expect(formatGradeShort("GRADE_2")).toBe("2.");
    expect(formatGradeShort("HIGH_SCHOOL_YEAR_2")).toBe("G2");
    expect(formatGradeLong("GRADE_2")).toBe("2. třída");
    expect(formatGradeLong("HIGH_SCHOOL_YEAR_2")).toBe("2. ročník gymnázia");
  });

  it("název třídy: label vyhrává, jinak se skládá — nikdy syrový enum", () => {
    expect(formatClassName({ grade: "GRADE_2", section: "B", label: "2.B" })).toBe("2.B");
    expect(formatClassName({ grade: "GRADE_2", section: "B", label: null })).toBe("2.B");
    expect(formatClassName({ grade: "HIGH_SCHOOL_YEAR_2", section: "2" })).toBe("G2");
    expect(formatClassName({ grade: "HIGH_SCHOOL_YEAR_2", section: "A" })).toBe("G2.A");
  });
});
