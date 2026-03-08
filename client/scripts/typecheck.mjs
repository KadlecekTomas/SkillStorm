import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const nextTypesDir = path.join(process.cwd(), ".next", "types");

if (existsSync(nextTypesDir)) {
  rmSync(nextTypesDir, { recursive: true, force: true });
}

const result = spawnSync("tsc", ["--noEmit"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
