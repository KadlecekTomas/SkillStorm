import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type PolicyCategory =
  | "Auth"
  | "RBAC"
  | "Multitenancy"
  | "Content"
  | "Submissions"
  | "Audit"
  | "UX"
  | "Onboarding";

type PolicyCase = {
  id: string;
  description?: string;
  passed: boolean;
  timestamp: string;
};

type PolicyReport = Record<PolicyCategory, PolicyCase[]>;

const REPORT_PATH = path.resolve(process.cwd(), "..", "logs", "fe-policy-report.json");
const CATEGORIES: PolicyCategory[] = [
  "Auth",
  "RBAC",
  "Multitenancy",
  "Content",
  "Submissions",
  "Audit",
  "UX",
  "Onboarding",
];

const ensureDirectory = () => {
  const dir = path.dirname(REPORT_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const initialReport = (): PolicyReport =>
  CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as PolicyReport);

const readReport = (): PolicyReport => {
  ensureDirectory();
  if (!existsSync(REPORT_PATH)) {
    const fresh = initialReport();
    writeFileSync(REPORT_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const raw = readFileSync(REPORT_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw) as PolicyReport;
    CATEGORIES.forEach((category) => {
      if (!parsed[category]) parsed[category] = [];
    });
    return parsed;
  } catch {
    const fallback = initialReport();
    writeFileSync(REPORT_PATH, JSON.stringify(fallback, null, 2));
    return fallback;
  }
};

const writeReport = (report: PolicyReport) => {
  ensureDirectory();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
};

export const resetPolicyScore = () => {
  writeReport(initialReport());
};

export const recordPolicyCheck = (
  category: PolicyCategory,
  caseId: string,
  passed: boolean,
  description?: string,
) => {
  const report = readReport();
  const existing = report[category].filter((entry) => entry.id !== caseId);
  existing.push({
    id: caseId,
    passed,
    timestamp: new Date().toISOString(),
    ...(description !== undefined ? { description } : {}),
  });
  report[category] = existing;
  writeReport(report);
};

export const summarizePolicy = () => {
  const report = readReport();
  return CATEGORIES.map((category) => {
    const cases = report[category];
    const passed = cases.filter((entry) => entry.passed).length;
    const total = cases.length;
    return {
      category,
      passed,
      total,
      missing: cases.filter((entry) => !entry.passed),
    };
  });
};

export const getReportPath = () => REPORT_PATH;
