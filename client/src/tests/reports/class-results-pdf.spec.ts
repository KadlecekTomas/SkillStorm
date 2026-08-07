import { describe, expect, it } from "vitest";
import { buildClassResultsPdfDocument } from "@/lib/reports/class-results-pdf";

describe("class results PDF", () => {
  it("builds a school report with summary, topics, risks and GDPR footer", () => {
    const doc = buildClassResultsPdfDocument({
      schoolName: "ZŠ Scénář",
      className: "8.A",
      academicYearName: "2026/2027",
      generatedAt: new Date("2026-08-07T12:00:00.000Z"),
      snapshot: {
        overallSuccessRate: 74,
        trendPercent: 0,
        assignmentCount: 6,
        problematicTopic: {
          name: "Zlomky",
          successRate: 52,
          errorCount: 12,
          shareOfTotalMistakes: 35,
        },
        studentsAtRiskCount: 2,
        studentsDecliningCount: 1,
      },
      topics: [
        {
          id: "topic-1",
          name: "Zlomky",
          successRate: 52,
          trend: "down",
          mistakeCount: 12,
          detail: {
            strugglingStudents: [],
            dominantErrors: ["Výpočet"],
            interventionLabel: "Opakování doporučeno",
          },
        },
      ],
      errorTypes: [
        {
          id: "error-1",
          label: "Výpočet",
          percent: 60,
          count: 12,
          lastSeen: null,
          trendPercent: 18,
        },
      ],
      students: [
        {
          id: "student-1",
          name: "Jan Novák",
          averageScorePercent: 48,
          trend: "DOWN",
          riskLevel: "HIGH",
          riskFlags: ["LOW_AVERAGE", "DECLINING"],
          lastActivityAt: "2026-08-06T09:00:00.000Z",
          profileHref: "/app/students/student-1",
        },
      ],
      trendData: [
        { date: "1. 8.", averagePercent: 68 },
        { date: "7. 8.", averagePercent: 74 },
      ],
      priorityAlerts: ["1 žák s vysokým rizikem: Jan Novák"],
    });

    expect(doc.pageSize).toBe("A4");
    expect(doc.info).toMatchObject({
      title: "SkillStorm - diagnostický report - 8.A",
      author: "ZŠ Scénář",
    });
    expect(JSON.stringify(doc)).toContain("Diagnostický report třídy");
    expect(JSON.stringify(doc)).toContain("Zlomky");
    expect(JSON.stringify(doc)).toContain("Jan Novák");
    expect(JSON.stringify(doc)).toContain("Důvěrné školní údaje");
  });
});
