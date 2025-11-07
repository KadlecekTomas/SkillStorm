// scripts/audit-project.js
// Node >=18, CommonJS. Spouštěj: `npm run audit`
// Audituje frontend (Next.js) i backend (NestJS) – struktura, importy, env, lint, build.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function logOK(msg) { console.log(`${C.green}✔${C.reset} ${msg}`); }
function logWARN(msg) { console.log(`${C.yellow}▲${C.reset} ${msg}`); }
function logERR(msg) { console.log(`${C.red}✖${C.reset} ${msg}`); }
function logInfo(msg) { console.log(`${C.cyan}ℹ${C.reset} ${msg}`); }

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function findDir(candidates) {
  for (const dir of candidates) {
    if (exists(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

function walk(root, exts = [".ts", ".tsx", ".js", ".jsx"]) {
  const out = [];
  (function rec(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) rec(p);
      else if (exts.includes(path.extname(name))) out.push(p);
    }
  })(root);
  return out;
}

function run(cmd, cwd) {
  try {
    const out = execSync(cmd, { cwd, stdio: "pipe", encoding: "utf8" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stdout || "", err: e.stderr || String(e) };
  }
}

function detectRoots() {
  const frontend = findDir([
    path.join(process.cwd(), "client"),
    path.join(process.cwd(), "frontend"),
    path.join(process.cwd(), "apps", "web"),
  ]);
  const backend = findDir([
    path.join(process.cwd(), "server"),
    path.join(process.cwd(), "backend"),
    path.join(process.cwd(), "apps", "api"),
  ]);
  return { frontend, backend };
}

function routeAudit(frontendRoot) {
  const report = {
    requiredRoutes: [
      "src/app/(dashboard)/layout.tsx",
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/app/(dashboard)/classrooms/page.tsx",
      "src/app/(dashboard)/tests/page.tsx",
      "src/app/(dashboard)/library/page.tsx",
      "src/app/(dashboard)/results/page.tsx",
      "src/app/(dashboard)/settings/page.tsx",
    ],
    missing: [],
    conflicts: [],
    warnings: [],
  };

  for (const rel of report.requiredRoutes) {
    const abs = path.join(frontendRoot, rel);
    if (!exists(abs)) report.missing.push(rel);
  }

  // detekce typických konfliktů paralelních routes
  const badCandidates = [
    "src/app/(dashboard)/page.tsx",
    "src/app/(dashboard)/teacher/page.tsx",
    "src/app/(dashboard)/student/page.tsx",
    "src/app/(dashboard)/dashboard/dashboard/page.tsx",
  ];
  for (const rel of badCandidates) {
    const abs = path.join(frontendRoot, rel);
    if (exists(abs)) report.conflicts.push(rel);
  }

  // rychlá kontrola sidebar constants
  const constantsFile = path.join(frontendRoot, "src", "utils", "constants.ts");
  const constantsSrc = readFileSafe(constantsFile);
  if (constantsSrc) {
    const mustLinks = [
      '"/dashboard"',
      '"/dashboard/classrooms"',
      '"/dashboard/tests"',
      '"/dashboard/library"',
      '"/dashboard/results"',
      '"/dashboard/settings"',
    ];
    for (const link of mustLinks) {
      if (!constantsSrc.includes(link)) {
        report.warnings.push(`Missing nav link ${link} in src/utils/constants.ts`);
      }
    }
    if (constantsSrc.includes('"/dashboard/test"')) {
      report.warnings.push("Stale nav link /dashboard/test still present");
    }
  } else {
    report.warnings.push("src/utils/constants.ts not found (nav cannot be verified)");
  }

  return report;
}

function findFilesUsingHooksWithoutUseClient(frontendRoot) {
  const appDir = path.join(frontendRoot, "src", "app");
  if (!exists(appDir)) return [];
  const files = walk(appDir, [".tsx", ".ts"]);
  const offenders = [];

  for (const f of files) {
    const src = readFileSafe(f);
    if (!src) continue;
    const usesHooks =
      /\buse(State|Effect|Memo|Callback|Ref|Reducer|LayoutEffect|ImperativeHandle)\b/.test(src) ||
      /react-hook-form/.test(src);
    const isTSX = path.extname(f) === ".tsx";
    if (isTSX && usesHooks) {
      // musí mít "use client" jako první řádek (nebo hned na začátku)
      const first3 = src.slice(0, 200);
      if (!/^["']use client["'];?/.test(first3)) {
        offenders.push(f.replace(frontendRoot + path.sep, ""));
      }
    }
  }
  return offenders;
}

function resolveAliasImport(frontendRoot, impPath) {
  // podpora aliasu "@/..."
  if (impPath.startsWith("@/")) {
    const base = path.join(frontendRoot, "src", impPath.replace(/^@\//, ""));
    const candidates = [
      base,
      base + ".ts",
      base + ".tsx",
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ];
    for (const c of candidates) {
      if (!exists(c)) continue;
      const stat = fs.statSync(c);
      if (stat.isDirectory()) continue;
      return c;
    }
    return null;
  }
  // relativní importy
  return null;
}

function importExportAudit(frontendRoot) {
  const srcDir = path.join(frontendRoot, "src");
  if (!exists(srcDir)) return { missingTargets: [], maybeExportMismatches: [] };

  const files = walk(srcDir, [".ts", ".tsx"]);
  const byPath = new Map(files.map((f) => [f, readFileSafe(f) || ""]));

  const missingTargets = [];
  const maybeExportMismatches = [];

  for (const f of files) {
    const src = byPath.get(f);
    if (!src) continue;

    // najdi importy
    const importRegex =
      /import\s+(([\w*\s{},]+)\s+from\s+)?["']([^"']+)["'];?/g;
    let m;
    while ((m = importRegex.exec(src))) {
      const raw = m[0];
      const spec = (m[2] || "").trim();
      const from = m[3];

      // jen alias "@/..."
      const target = resolveAliasImport(frontendRoot, from);
      if (!target) continue;

      const targetSrc = byPath.get(target) || readFileSafe(target);
      if (!targetSrc) {
        missingTargets.push({
          fromFile: f.replace(frontendRoot + path.sep, ""),
          import: raw.trim(),
          resolved: target ? target.replace(frontendRoot + path.sep, "") : "(not found)",
        });
        continue;
      }

      // hrubá kontrola default vs named
      const hasDefaultExport = /export\s+default\s+/.test(targetSrc);
      const namedWanted = /{([^}]+)}/.exec(spec);
      const defaultWanted = spec && !spec.includes("{") && spec.length > 0;

      if (namedWanted) {
        // vytahej jména
        const names = namedWanted[1]
          .split(",")
          .map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ""));
        for (const n of names) {
          const hasNamed =
            new RegExp(`export\\s+(const|function|class|type|interface)\\s+${n}\\b`).test(
              targetSrc,
            ) ||
            new RegExp(`export\\s*(type\\s*)?{[^}]*\\b${n}\\b[^}]*}`).test(targetSrc);
          if (!hasNamed) {
            maybeExportMismatches.push({
              fromFile: f.replace(frontendRoot + path.sep, ""),
              import: raw.trim(),
              issue: `Named export "${n}" not found in target`,
              target: target.replace(frontendRoot + path.sep, ""),
            });
          }
        }
      } else if (defaultWanted) {
        if (!hasDefaultExport) {
          maybeExportMismatches.push({
            fromFile: f.replace(frontendRoot + path.sep, ""),
            import: raw.trim(),
            issue: "Default export not found in target",
            target: target.replace(frontendRoot + path.sep, ""),
          });
        }
      }
    }
  }

  return { missingTargets, maybeExportMismatches };
}

function envAudit(rootDirs) {
  const places = [
    { name: "repo root", dir: process.cwd() },
    { name: "frontend", dir: rootDirs.frontend },
    { name: "backend", dir: rootDirs.backend },
  ].filter((p) => p.dir);

  const out = [];
  for (const p of places) {
    const envExample = path.join(p.dir, ".env.example");
    const env = path.join(p.dir, ".env");
    const exampleSrc = readFileSafe(envExample);
    const envSrc = readFileSafe(env);
    if (!exampleSrc) {
      out.push({ scope: p.name, missingExample: true, missingVars: [] });
      continue;
    }
    const wanted = exampleSrc
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0]);

    const present = (envSrc || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0]);

    const missingVars = wanted.filter((v) => !present.includes(v));
    out.push({ scope: p.name, missingExample: false, missingVars });
  }
  return out;
}

function gitAudit() {
  try {
    const s = execSync("git status -s", { encoding: "utf8" });
    return s.trim().split("\n").filter(Boolean);
  } catch { return []; }
}

function runNpmScripts(dir, label) {
  if (!dir) return { lint: null, build: null };
  logInfo(`Running npm scripts in ${label}: ${dir}`);
  const lint = run("npm run lint", dir);
  const build = run("npm run build", dir);
  return { lint, build };
}

function main() {
  console.log(`${C.bold}🔍 SkillStorm Audit Report${C.reset} — ${new Date().toISOString()}\n`);

  const roots = detectRoots();
  if (!roots.frontend && !roots.backend) {
    logERR("Nenalezen frontend ani backend. Očekávám složky /client nebo /frontend a /server nebo /backend.");
    process.exit(1);
  }
  if (roots.frontend) logOK(`Frontend: ${roots.frontend}`);
  else logWARN("Frontend nenalezen");
  if (roots.backend) logOK(`Backend: ${roots.backend}`);
  else logWARN("Backend nenalezen");

  const result = {
    meta: { ts: new Date().toISOString() },
    frontend: {},
    backend: {},
    env: [],
    git: [],
    summary: {},
  };

  // FRONTEND checks
  if (roots.frontend) {
    console.log(`\n${C.bold}— Frontend audit —${C.reset}`);
    const route = routeAudit(roots.frontend);
    const hookOffenders = findFilesUsingHooksWithoutUseClient(roots.frontend);
    const impExp = importExportAudit(roots.frontend);

    result.frontend.routes = route;
    result.frontend.hookFilesMissingUseClient = hookOffenders;
    result.frontend.imports = impExp;

    if (route.missing.length === 0) logOK("Všechny povinné dashboard routes existují");
    else {
      logERR("Chybějící routes:");
      route.missing.forEach((r) => console.log("  - " + r));
    }

    if (route.conflicts.length) {
      logERR("Zjištěny konfliktní/duplicitní routes:");
      route.conflicts.forEach((r) => console.log("  - " + r));
    } else logOK("Žádné paralelní/duplicitní routes");

    if (hookOffenders.length) {
      logWARN(`Komponenty s hooky bez "use client":`);
      hookOffenders.forEach((f) => console.log("  - " + f));
    } else logOK(`Všechny TSX s hooky mají "use client"`);

    if (impExp.missingTargets.length) {
      logERR("Importy míří na neexistující cíle:");
      impExp.missingTargets.forEach((i) =>
        console.log(`  - ${i.fromFile} → ${i.resolved} (${i.import})`)
      );
    } else logOK("Všechny alias importy '@/…' odkazují na existující soubory");

    if (impExp.maybeExportMismatches.length) {
      logERR("Potenciální nesoulad default/named exportů:");
      impExp.maybeExportMismatches.slice(0, 20).forEach((i) =>
        console.log(`  - ${i.fromFile} → ${i.target}: ${i.issue} [${i.import}]`)
      );
      if (impExp.maybeExportMismatches.length > 20) console.log("  … další výskyty zkráceny");
    } else logOK("Exporty zhruba odpovídají importům (rychlá kontrola)");
  }

  // BACKEND checks (jen lint/build – strukturu řeší Nest CLI)
  if (roots.backend) {
    console.log(`\n${C.bold}— Backend audit —${C.reset}`);
    // volitelně by šlo doplnit kontrolu Prisma schema apod.
    logOK("Backend připraven k lint/build auditu");
  }

  // ENV
  console.log(`\n${C.bold}— ENV audit —${C.reset}`);
  const env = envAudit(roots);
  result.env = env;
  for (const e of env) {
    if (e.missingExample) {
      logWARN(`${e.scope}: chybí .env.example`);
      continue;
    }
    if (e.missingVars.length) {
      logWARN(`${e.scope}: chybějící proměnné v .env → ${e.missingVars.join(", ")}`);
    } else logOK(`${e.scope}: .env odpovídá .env.example`);
  }

  // GIT
  console.log(`\n${C.bold}— Git status —${C.reset}`);
  const git = gitAudit();
  result.git = git;
  if (git.length) {
    logWARN("Necommitované změny:");
    git.forEach((l) => console.log("  " + l));
  } else logOK("Pracovní adresář čistý");

  // RUN SCRIPTS
  console.log(`\n${C.bold}— Lint & Build —${C.reset}`);
  const feRun = runNpmScripts(roots.frontend, "frontend");
  const beRun = runNpmScripts(roots.backend, "backend");

  result.frontend.npm = feRun;
  result.backend.npm = beRun;

  if (feRun.lint) {
    feRun.lint.ok ? logOK("Frontend lint OK") : logERR("Frontend lint FAILED");
  }
  if (feRun.build) {
    feRun.build.ok ? logOK("Frontend build OK") : logERR("Frontend build FAILED");
  }
  if (beRun.lint) {
    beRun.lint.ok ? logOK("Backend lint OK") : logERR("Backend lint FAILED");
  }
  if (beRun.build) {
    beRun.build.ok ? logOK("Backend build OK") : logERR("Backend build FAILED");
  }

  // SUMMARY
  const errors = [];
  if (roots.frontend) {
    if (result.frontend.routes?.missing?.length) errors.push("Missing frontend routes");
    if (result.frontend.routes?.conflicts?.length) errors.push("Parallel/duplicate routes");
    if (result.frontend.imports?.missingTargets?.length) errors.push("Missing import targets");
    if (result.frontend.imports?.maybeExportMismatches?.length) errors.push("Export/import mismatch");
    if (feRun.build && !feRun.build.ok) errors.push("Frontend build failed");
    if (feRun.lint && !feRun.lint.ok) errors.push("Frontend lint failed");
  }
  if (roots.backend) {
    if (beRun.build && !beRun.build.ok) errors.push("Backend build failed");
    if (beRun.lint && !beRun.lint.ok) errors.push("Backend lint failed");
  }
  result.summary = {
    ok: errors.length === 0,
    errors,
  };

  // OUTPUT JSON
  const jsonPath = path.join(process.cwd(), "audit-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");

  console.log(`\n${C.bold}— Summary —${C.reset}`);
  if (errors.length === 0) {
    console.log(`${C.green}✅ All good!${C.reset}`);
  } else {
    errors.forEach((e) => logERR(e));
  }
  console.log(`${C.gray}Report saved to ${jsonPath}${C.reset}\n`);

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
