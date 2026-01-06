import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const categories = [
  "Auth",
  "RBAC",
  "Multitenancy",
  "Content",
  "Submissions",
  "Audit",
];

const report = categories.reduce((acc, category) => {
  acc[category] = [];
  return acc;
}, {});

const reportPath = path.resolve(process.cwd(), "logs", "fe-policy-report.json");
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2));
