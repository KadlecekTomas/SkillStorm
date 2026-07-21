import { describe, expect, it } from "vitest";
import { roleLabel, submissionStatusLabel } from "@/lib/labels";

describe("submissionStatusLabel (regrese P1-6)", () => {
  it("překládá stavy odevzdání do češtiny", () => {
    expect(submissionStatusLabel("PENDING")).toBe("Čeká na vyhodnocení");
    expect(submissionStatusLabel("APPROVED")).toBe("Vyhodnoceno");
    expect(submissionStatusLabel("REJECTED")).toBe("Čeká na ruční vyhodnocení");
  });

  it("nikdy nevrací surový enum pro známé hodnoty", () => {
    for (const s of ["PENDING", "APPROVED", "REJECTED"]) {
      expect(submissionStatusLabel(s)).not.toBe(s);
    }
  });

  it("null/undefined → pomlčka", () => {
    expect(submissionStatusLabel(null)).toBe("—");
    expect(submissionStatusLabel(undefined)).toBe("—");
  });
});

describe("roleLabel (regrese P1-6)", () => {
  it("překládá role do češtiny", () => {
    expect(roleLabel("STUDENT")).toBe("Žák");
    expect(roleLabel("TEACHER")).toBe("Učitel");
    expect(roleLabel("DIRECTOR")).toBe("Ředitel");
    expect(roleLabel("OWNER")).toBe("Vlastník");
    expect(roleLabel("PARENT")).toBe("Rodič");
  });

  it("žák nikdy nevidí anglické 'student'", () => {
    expect(roleLabel("STUDENT")).not.toBe("student");
    expect(roleLabel("STUDENT")).not.toBe("STUDENT");
  });
});
