#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const SERVER_SRC = path.join(ROOT, "server", "src");
const IGNORED = [path.sep + "auth" + path.sep, path.sep + "health" + path.sep];

const controllersMissing = [];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".controller.ts")) continue;
    if (IGNORED.some((segment) => fullPath.includes(segment))) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    const hasDecorator =
      content.includes("@Permission(") ||
      content.includes("@Roles(") ||
      content.includes("@Public(");
    if (!hasDecorator) {
      controllersMissing.push(path.relative(SERVER_SRC, fullPath));
    }
  }
};

walk(SERVER_SRC);

if (controllersMissing.length > 0) {
  console.error("⚠️  RBAC checker found controllers without decorators:");
  controllersMissing.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
} else {
  console.log("✅ RBAC checker: all controllers have permission metadata.");
}
