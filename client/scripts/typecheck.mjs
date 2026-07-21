import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Typecheck s preflightem: tichá zelená je horší než červená. Původní verze
 * volala `tsc` z PATH — bez lokálních node_modules mohla projít přes náhodný
 * globální/zděděný binář a tvářit se zeleně. Teď:
 *  1. tsc se resolvuje VÝHRADNĚ z lokálních závislostí, jinak hlasitý pád,
 *  2. po úspěchu se vypíše počet souborů, které tsc reálně viděl — zelená
 *     bez čísla neexistuje.
 */
const require = createRequire(import.meta.url);
let tscBin;
try {
  tscBin = require.resolve("typescript/lib/tsc.js");
} catch {
  console.error(
    "✗ typecheck: TypeScript není nainstalovaný (chybí node_modules?). " +
      "Spusť `npm install` v client/ — bez toho typecheck NIC nezkontroloval.",
  );
  process.exit(1);
}

const nextTypesDir = path.join(process.cwd(), ".next", "types");
if (existsSync(nextTypesDir)) {
  rmSync(nextTypesDir, { recursive: true, force: true });
}

const result = spawnSync(process.execPath, [tscBin, "--noEmit"], {
  stdio: "inherit",
});
if (result.error) {
  console.error("✗ typecheck: tsc se nepodařilo spustit:", result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Důkaz rozsahu: rychlý resolve-only průchod (bez typecheck) spočítá soubory.
const list = spawnSync(
  process.execPath,
  [tscBin, "--noEmit", "--listFilesOnly"],
  { encoding: "utf8" },
);
const count = (list.stdout ?? "")
  .split("\n")
  .filter((line) => line.trim().length > 0).length;
if (count === 0) {
  console.error(
    "✗ typecheck: tsc neviděl žádné soubory — to není zelená, to je prázdno.",
  );
  process.exit(1);
}
console.log(`✓ typecheck OK — tsc zkontroloval ${count} souborů`);
