#!/usr/bin/env node
/**
 * Jednoduchá statická kontrola RBAC dekorátorů pro backend controllery.
 *
 * K čemu slouží:
 * - projde controllery v `server/src`,
 * - zkontroluje, že každý controller má základní access metadata,
 * - upozorní na soubory, kde chybí `@Permission`, `@Roles` nebo `@Public`.
 *
 * Jde jen o strukturální pojistku. Neověřuje runtime chování,
 * správnost oprávnění ani autorizaci uvnitř service vrstvy.
 */
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
      content.includes("@Public(") ||
      // platform admin stack: SystemRole/PlatformAccessLevel guards
      content.includes("@RequirePlatformAccess(") ||
      content.includes("@RequireSystemRole(") ||
      // explicit opt-out: handler enforces RBAC inline (must justify why)
      content.includes("rbac-checked: inline");
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
