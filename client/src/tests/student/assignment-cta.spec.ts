import { describe, expect, it } from "vitest";
import {
  assignmentLauncherHref,
  resolveAssignmentCta,
} from "@/lib/student-assignments";

describe("assignmentLauncherHref", () => {
  it("cílová URL launcheru má vždy /app prefix (regrese P0-1)", () => {
    expect(assignmentLauncherHref("a1")).toBe("/app/assignments/a1");
    expect(assignmentLauncherHref("a1")).not.toBe("/assignments/a1");
    expect(assignmentLauncherHref("a1").startsWith("/app/")).toBe(true);
  });
});

describe("resolveAssignmentCta (regrese P0-2)", () => {
  it("zadání bez submission a otevřené → Spustit test na launcher", () => {
    const cta = resolveAssignmentCta({
      id: "asg-1",
      submissionId: null,
      effectiveStatus: "OPEN",
    });
    expect(cta).toEqual({
      kind: "launch",
      label: "Spustit test",
      href: "/app/assignments/asg-1",
    });
  });

  it("rozpracovaný pokus → Pokračovat na launcher (ne na výsledek)", () => {
    const cta = resolveAssignmentCta({
      id: "asg-2",
      submissionId: null,
      effectiveStatus: "IN_PROGRESS",
    });
    expect(cta.kind).toBe("launch");
    expect(cta).toMatchObject({ label: "Pokračovat", href: "/app/assignments/asg-2" });
  });

  it("dokončený pokus se skutečným submissionId → odkaz na výsledek", () => {
    const cta = resolveAssignmentCta({
      id: "asg-3",
      submissionId: "sub-99",
      effectiveStatus: "SUBMITTED",
    });
    expect(cta).toEqual({
      kind: "result",
      label: "Zobrazit výsledek",
      href: "/app/results/sub-99",
    });
  });

  it("INVARIANT: nikdy nepoužije ID zadání jako submissionId", () => {
    // SUBMITTED/CLOSED/NO_ATTEMPTS_LEFT bez submissionId nesmí vyrobit /app/results/<assignmentId>
    for (const status of ["SUBMITTED", "CLOSED", "NO_ATTEMPTS_LEFT"] as const) {
      const cta = resolveAssignmentCta({
        id: "asg-4",
        submissionId: null,
        effectiveStatus: status,
      });
      expect(cta.kind).toBe("none");
      expect(JSON.stringify(cta)).not.toContain("/app/results/asg-4");
      expect("href" in cta).toBe(false);
    }
  });

  it("UPCOMING → žádná akce, jen informační stav", () => {
    const cta = resolveAssignmentCta({
      id: "asg-5",
      submissionId: null,
      effectiveStatus: "UPCOMING",
    });
    expect(cta).toEqual({ kind: "none", label: "Zatím neotevřeno" });
  });

  it("uzavřené zadání se submissionId → stále nabídne výsledek", () => {
    const cta = resolveAssignmentCta({
      id: "asg-6",
      submissionId: "sub-6",
      effectiveStatus: "CLOSED",
    });
    expect(cta).toMatchObject({ kind: "result", href: "/app/results/sub-6" });
  });
});
