import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const normalize = (value) => value.split(path.sep).join('/');
const exists = (relativePath) => fs.existsSync(path.resolve(root, relativePath));

const HUMAN_DOC_ROOTS = [
  'README.md',
  'docs',
  'server/test/e2e-legacy/README.md',
];

// Historical documents may preserve stale paths, brands and links because they
// capture an older repository state. They still must be registered exactly.
const HISTORICAL_DOCS = new Set([
  'docs/campaigns-decisions.md',
  'docs/roadmap/doctrine.md',
  'docs/roadmap/2026-07-napadnik.md',
  'docs/production-roadmap.md',
  'docs/production-audit.md',
  'docs/production-sso-hardening-audit.md',
  'docs/ops/production-readiness.md',
  'docs/ops/query-limits-audit.md',
  'docs/testing/e2e-baseline-audit.md',
  'docs/visual-qa-findings.md',
  'docs/devlog/2026-06-17-focus-test.md',
  'docs/analytics/student-progress-analysis.md',
  'docs/analytics/student-progress-phase-2-plan.md',
  'docs/analytics/student-progress-prisma-models.md',
  'docs/guardian-project.md',
  'docs/guardian-spec.md',
  'docs/guardian/etapa-a-analyza.md',
  'docs/guardian/etapa-b-stop2-navrh.md',
  'docs/guardian/etapa-c-stop3-navrh.md',
  'server/test/e2e-legacy/README.md',
]);

const NORMATIVE_DOCS = [
  'docs/README.md',
  'docs/roadmap/master.md',
  'docs/interactive-curriculum/PRODUCTION-CONTRACT.md',
  'docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md',
  'docs/tenant-rbac-test-matrix.md',
];

function walk(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return relativePath.endsWith('.md') ? [normalize(relativePath)] : [];
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return walk(child);
    return entry.isFile() && entry.name.endsWith('.md') ? [normalize(child)] : [];
  });
}

function stripCodeFences(content) {
  return content.replace(/```[\s\S]*?```/g, '');
}

function stripAnchorAndQuery(target) {
  return target.split('#')[0].split('?')[0];
}

function decodeTarget(target) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function resolveLocalTarget(fromDoc, rawTarget) {
  let target = rawTarget.trim();
  if (!target || target.startsWith('#') || /^(https?:|mailto:|tel:|data:)/i.test(target)) {
    return null;
  }

  target = target.replace(/\s+["'][^"']*["']\s*$/, '');
  target = stripAnchorAndQuery(decodeTarget(target));
  if (!target) return null;

  return normalize(
    path.relative(root, path.resolve(root, path.dirname(fromDoc), target)),
  );
}

const docs = [...new Set(HUMAN_DOC_ROOTS.flatMap(walk))].sort();
const registryPath = 'docs/README.md';
const errors = [];
const warnings = [];

if (!docs.includes('README.md')) {
  errors.push('Root README.md was not discovered.');
}
if (!exists(registryPath)) {
  errors.push(`Missing documentation registry: ${registryPath}`);
}

const registry = exists(registryPath)
  ? fs.readFileSync(path.resolve(root, registryPath), 'utf8')
  : '';
const registryWithoutCode = stripCodeFences(registry);
const registryLinks = [
  ...registryWithoutCode.matchAll(/\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/g),
];
const registryDocTargets = new Set();

// 1) Registry links must resolve.
for (const [, rawTarget] of registryLinks) {
  const resolved = resolveLocalTarget(registryPath, rawTarget);
  if (!resolved) continue;
  registryDocTargets.add(resolved);
  if (!exists(resolved)) {
    errors.push(`Registry link target does not exist: ${rawTarget} -> ${resolved}`);
  }
}

// 2) Every discovered human-authored Markdown must be registered by exact path.
for (const doc of docs) {
  if (doc === 'README.md' || doc === registryPath) continue;
  if (!registryDocTargets.has(doc)) {
    errors.push(`Unregistered Markdown document: ${doc}`);
  }
}

// 3) Historical allowlist must contain only real, exactly registered files.
for (const doc of HISTORICAL_DOCS) {
  if (!exists(doc)) {
    errors.push(`Historical allowlist references missing file: ${doc}`);
    continue;
  }
  if (!registryDocTargets.has(doc)) {
    errors.push(`Historical document is not exactly registered: ${doc}`);
  }
}

// 4) Active docs must not regress to known stale setup patterns.
const stalePatterns = [
  { regex: /^#\s+EDUTO\b/im, label: 'legacy EDUTO document heading' },
  { regex: /\/Users\/[A-Za-z0-9._-]+\//, label: 'machine-local /Users/... path' },
  { regex: /POSTGRES_DB\s*=\s*eduto\b/i, label: 'legacy POSTGRES_DB=eduto example' },
  { regex: /JWT_SECRET\s*=\s*supersecret\b/i, label: 'demo JWT secret' },
  { regex: /DATABASE_URL_TEST[^\n]*\/eduto_test\b/i, label: 'legacy eduto_test database' },
];

for (const doc of docs) {
  if (HISTORICAL_DOCS.has(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');
  for (const { regex, label } of stalePatterns) {
    if (regex.test(content)) errors.push(`${doc}: contains ${label}`);
  }
}

// 5) Root identity and normative docs are hard requirements.
const rootReadme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf8');
if (!/^#\s+SkillStorm\s*$/m.test(rootReadme)) {
  errors.push('README.md must have the canonical "# SkillStorm" heading.');
}

for (const doc of NORMATIVE_DOCS) {
  if (!exists(doc)) {
    errors.push(`Missing normative document: ${doc}`);
    continue;
  }
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');
  if (!/\*\*Owner:\*\*/i.test(content)) {
    errors.push(`${doc}: normative document is missing Owner metadata`);
  }
}

// 6) Every active doc under docs/ must visibly expose lifecycle metadata.
// Scope/Purpose/Target/Authority are accepted only when they explicitly state
// what the document governs; the registry remains canonical for classification.
for (const doc of docs) {
  if (doc === 'README.md' || HISTORICAL_DOCS.has(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');

  if (!/\*\*Status:\*\*/i.test(content)) {
    errors.push(`${doc}: missing required Status metadata`);
  }
  if (!/\*\*Last (verified|review(?:ed)?):\*\*/i.test(content)) {
    errors.push(`${doc}: missing Last verified/reviewed metadata`);
  }
  if (!/\*\*(Scope|Purpose|Target|Authority):\*\*/i.test(content)) {
    errors.push(`${doc}: missing explicit Scope/Purpose/Target/Authority metadata`);
  }
  if (!/\*\*Owner:\*\*/i.test(content) && !NORMATIVE_DOCS.includes(doc)) {
    warnings.push(`${doc}: Owner is supplied by the registry but not repeated in the file header.`);
  }
}

// 7) Validate relative links in all non-historical human docs.
for (const doc of docs) {
  if (HISTORICAL_DOCS.has(doc)) continue;
  const content = stripCodeFences(fs.readFileSync(path.resolve(root, doc), 'utf8'));
  const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];

  for (const [, rawTarget] of links) {
    const resolved = resolveLocalTarget(doc, rawTarget);
    if (!resolved) continue;
    if (!exists(resolved)) {
      errors.push(`${doc}: broken relative link -> ${rawTarget} -> ${resolved}`);
    }
  }
}

// 8) Deliberate TODO language is visible but non-blocking.
for (const doc of docs) {
  if (doc === 'README.md' || HISTORICAL_DOCS.has(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');
  if (/\bTODO\b/i.test(content)) {
    warnings.push(`${doc}: contains TODO; verify it is intentional and scoped.`);
  }
}

console.log(`Documentation integrity: ${docs.length} human Markdown files scanned.`);
console.log(`Registry: ${registryDocTargets.size} local Markdown targets resolved.`);
console.log(`Historical/superseded: ${HISTORICAL_DOCS.size} files classified.`);

if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (errors.length > 0) {
  console.error(`Errors (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('Documentation integrity check passed.');