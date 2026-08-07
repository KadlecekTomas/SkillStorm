import type { DiagnosticSnapshotData } from "@/components/results/DiagnosticSnapshot";
import type { ErrorTypeRow, TopicRow } from "@/components/results/ProblemMap";
import type { StudentRiskRow } from "@/components/results/StudentRiskRadar";
import type { TrendDataPoint } from "@/components/results/PerformanceTrend";

export type ClassResultsPdfInput = {
  schoolName: string;
  className: string;
  academicYearName: string;
  generatedAt: Date;
  snapshot: DiagnosticSnapshotData;
  topics: TopicRow[];
  errorTypes: ErrorTypeRow[];
  students: StudentRiskRow[];
  trendData: TrendDataPoint[];
  priorityAlerts: string[];
};

type PdfMakeRuntime = {
  vfs?: Record<string, string>;
  createPdf: (definition: unknown) => {
    download: (filename?: string) => void;
    getBlob: (callback: (blob: Blob) => void) => void;
  };
};

type PdfFontVfsModule =
  | Record<string, string>
  | { vfs?: Record<string, string>; pdfMake?: { vfs?: Record<string, string> } };

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  panel: "#f8fafc",
  green: "#047857",
  greenSoft: "#ecfdf5",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  red: "#b91c1c",
  redSoft: "#fef2f2",
};

function round(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function riskLabel(level: StudentRiskRow["riskLevel"]): string {
  if (level === "HIGH") return "Vysoké";
  if (level === "MEDIUM") return "Střední";
  if (level === "NO_DATA") return "Bez dat";
  return "Nízké";
}

function trendLabel(trend: StudentRiskRow["trend"] | TopicRow["trend"]): string {
  if (trend === "UP" || trend === "up") return "Roste";
  if (trend === "DOWN" || trend === "down") return "Klesá";
  return "Beze změny";
}

function riskFlags(flags: StudentRiskRow["riskFlags"]): string {
  const labels: Record<StudentRiskRow["riskFlags"][number], string> = {
    LOW_AVERAGE: "Nízký průměr",
    INACTIVE: "Neaktivita",
    DECLINING: "Klesající trend",
  };
  return flags.length ? flags.map((flag) => labels[flag]).join(", ") : "-";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatActivity(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function metricCard(label: string, value: string, note: string, tone: "green" | "amber" | "red") {
  const background =
    tone === "green" ? COLORS.greenSoft : tone === "amber" ? COLORS.amberSoft : COLORS.redSoft;
  const valueColor =
    tone === "green" ? COLORS.green : tone === "amber" ? COLORS.amber : COLORS.red;
  return {
    margin: [0, 0, 8, 0],
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              { text: label, fontSize: 8, color: COLORS.muted, margin: [0, 0, 0, 4] },
              { text: value, fontSize: 18, bold: true, color: valueColor, margin: [0, 0, 0, 4] },
              { text: note, fontSize: 7.5, color: COLORS.muted },
            ],
            fillColor: background,
            margin: [10, 9, 10, 9],
          },
        ],
      ],
    },
    layout: "noBorders",
  };
}

function sectionTitle(text: string) {
  return {
    text,
    fontSize: 13,
    bold: true,
    color: COLORS.ink,
    margin: [0, 14, 0, 7],
  };
}

function trendCanvas(data: TrendDataPoint[]) {
  const points = data.slice(-7);
  if (!points.length) {
    return { text: "Pro trend zatím nejsou data.", color: COLORS.muted, fontSize: 8 };
  }

  return {
    table: {
      widths: [70, "*", 40],
      body: points.map((point) => [
        { text: point.date, fontSize: 8, color: COLORS.muted, margin: [0, 3, 5, 3] },
        {
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 5,
              w: 260,
              h: 7,
              r: 3,
              color: COLORS.line,
            },
            {
              type: "rect",
              x: 0,
              y: 5,
              w: Math.max(3, Math.min(260, (round(point.averagePercent) / 100) * 260)),
              h: 7,
              r: 3,
              color: COLORS.green,
            },
          ],
          margin: [0, 1, 0, 0],
        },
        {
          text: `${round(point.averagePercent)} %`,
          fontSize: 8,
          bold: true,
          alignment: "right",
          margin: [5, 3, 0, 3],
        },
      ]),
    },
    layout: "noBorders",
  };
}

export function buildClassResultsPdfDocument(input: ClassResultsPdfInput): Record<string, unknown> {
  const riskyStudents = input.students.filter(
    (student) => student.riskLevel === "HIGH" || student.riskLevel === "MEDIUM",
  );
  const successTone = input.snapshot.overallSuccessRate >= 80 ? "green" : input.snapshot.overallSuccessRate >= 60 ? "amber" : "red";
  const riskTone = input.snapshot.studentsAtRiskCount === 0 ? "green" : input.snapshot.studentsAtRiskCount <= 2 ? "amber" : "red";

  const topicRows = input.topics.length
    ? input.topics.map((topic) => [
        topic.name,
        `${round(topic.successRate)} %`,
        trendLabel(topic.trend),
        String(topic.mistakeCount),
        topic.detail?.interventionLabel || "-",
      ])
    : [["Bez dat", "-", "-", "-", "-"]];

  const errorRows = input.errorTypes.length
    ? input.errorTypes.map((error) => [
        error.label,
        `${round(error.percent)} %`,
        String(error.count),
        error.trendPercent != null && error.trendPercent > 0
          ? `Nárůst +${round(error.trendPercent)} %`
          : "Stabilní / klesá",
      ])
    : [["Bez dat", "-", "-", "-"]];

  const studentRows = riskyStudents.length
    ? riskyStudents.map((student) => [
        student.name,
        student.riskLevel === "NO_DATA" ? "-" : `${round(student.averageScorePercent)} %`,
        trendLabel(student.trend),
        riskLabel(student.riskLevel),
        riskFlags(student.riskFlags),
        formatActivity(student.lastActivityAt),
      ])
    : [["Ve vybrané třídě nejsou žáci se zvýšeným rizikem.", "-", "-", "-", "-", "-"]];

  return {
    pageSize: "A4",
    pageMargins: [38, 48, 38, 48],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: COLORS.ink,
      lineHeight: 1.18,
    },
    info: {
      title: `SkillStorm - diagnostický report - ${input.className}`,
      author: input.schoolName,
      subject: "Diagnostický report školních výsledků",
    },
    header: {
      columns: [
        { text: "SkillStorm", bold: true, color: COLORS.green, fontSize: 10 },
        { text: input.schoolName, alignment: "right", color: COLORS.muted, fontSize: 8 },
      ],
      margin: [38, 20, 38, 0],
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: "Důvěrné školní údaje - pouze pro oprávněné uživatele.",
          fontSize: 7,
          color: COLORS.muted,
        },
        {
          text: `Strana ${currentPage} / ${pageCount}`,
          alignment: "right",
          fontSize: 7,
          color: COLORS.muted,
        },
      ],
      margin: [38, 12, 38, 0],
    }),
    content: [
      {
        text: "Diagnostický report třídy",
        fontSize: 10,
        bold: true,
        color: COLORS.green,
        margin: [0, 0, 0, 3],
      },
      { text: input.className, fontSize: 24, bold: true, margin: [0, 0, 0, 3] },
      {
        text: `${input.academicYearName}  |  Vytvořeno ${formatDate(input.generatedAt)}`,
        color: COLORS.muted,
        fontSize: 8.5,
        margin: [0, 0, 0, 14],
      },
      {
        columns: [
          metricCard(
            "Celková úspěšnost",
            `${round(input.snapshot.overallSuccessRate)} %`,
            `${input.snapshot.assignmentCount} ${input.snapshot.assignmentCount === 1 ? "úkol" : "úkolů"}`,
            successTone,
          ),
          metricCard(
            "Žáci v riziku",
            String(input.snapshot.studentsAtRiskCount),
            input.snapshot.studentsDecliningCount
              ? `${input.snapshot.studentsDecliningCount} s klesajícím trendem`
              : "bez klesajícího trendu",
            riskTone,
          ),
          metricCard(
            "Nejproblematičtější téma",
            input.snapshot.problematicTopic?.name ?? "Bez dat",
            input.snapshot.problematicTopic
              ? `${round(input.snapshot.problematicTopic.successRate)} % úspěšnost`
              : "zatím bez vyhodnocení",
            input.snapshot.problematicTopic && input.snapshot.problematicTopic.successRate < 60
              ? "red"
              : "amber",
          ),
        ],
        columnGap: 4,
      },
      sectionTitle("Prioritní upozornění"),
      input.priorityAlerts.length
        ? {
            ul: input.priorityAlerts.map((alert) => ({ text: alert, margin: [0, 1, 0, 1] })),
            color: COLORS.red,
          }
        : {
            text: "Aktuálně nejsou evidována prioritní upozornění.",
            color: COLORS.muted,
          },
      sectionTitle("Výkon podle témat"),
      {
        table: {
          headerRows: 1,
          widths: ["*", 58, 62, 40, 110],
          body: [
            ["Téma", "Úspěšnost", "Trend", "Chyby", "Doporučení"],
            ...topicRows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.panel : null),
          hLineColor: () => COLORS.line,
          vLineColor: () => COLORS.line,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      sectionTitle("Typy chyb"),
      {
        table: {
          headerRows: 1,
          widths: ["*", 65, 55, 105],
          body: [["Typ chyby", "Podíl", "Počet", "Trend"], ...errorRows],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.panel : null),
          hLineColor: () => COLORS.line,
          vLineColor: () => COLORS.line,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      sectionTitle("Žáci vyžadující pozornost"),
      {
        table: {
          headerRows: 1,
          widths: [90, 48, 52, 48, "*", 62],
          body: [["Žák", "Průměr", "Trend", "Riziko", "Signály", "Aktivita"], ...studentRows],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.panel : null),
          hLineColor: () => COLORS.line,
          vLineColor: () => COLORS.line,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
      sectionTitle("Trend průměrné úspěšnosti"),
      trendCanvas(input.trendData),
      {
        text: "Poznámka: Report vychází z dat dostupných v SkillStorm v okamžiku vytvoření. Slouží jako podklad pro pedagogické rozhodování; nenahrazuje odborné posouzení učitele.",
        fontSize: 7.5,
        color: COLORS.muted,
        margin: [0, 18, 0, 0],
      },
    ],
    styles: {
      tableHeader: { bold: true, fillColor: COLORS.panel },
    },
  };
}

async function loadPdfMake(): Promise<PdfMakeRuntime> {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);

  const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as unknown as PdfMakeRuntime;
  const fonts = (fontModule.default ?? fontModule) as unknown as PdfFontVfsModule;
  const fontObject = fonts as { vfs?: Record<string, string>; pdfMake?: { vfs?: Record<string, string> } };
  const vfs = fontObject.pdfMake?.vfs ?? fontObject.vfs ?? (fonts as Record<string, string>);
  if (vfs && Object.keys(vfs).length > 0) {
    pdfMake.vfs = vfs;
  }
  return pdfMake;
}

export async function downloadClassResultsPdf(input: ClassResultsPdfInput): Promise<string> {
  const pdfMake = await loadPdfMake();
  const definition = buildClassResultsPdfDocument(input);
  const filename = `SkillStorm-${safeFilenamePart(input.schoolName)}-${safeFilenamePart(input.className)}-${formatDate(input.generatedAt).replace(/\./g, "-")}.pdf`;
  pdfMake.createPdf(definition).download(filename);
  return filename;
}
