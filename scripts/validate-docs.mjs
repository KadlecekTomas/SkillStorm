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

const HISTORICAL_DOCS = new Set([
  'docs/roadmap/doctrine.md',
  'docs/roadmap/2026-07-napadnik.md',
  'docs/production-roadmap.md',
  'docs/production-audit.md',
  'docs/production-sso-hardening-audit.md',
  'docs/ops/production-readiness.md',
  'docs/testing/e2e-baseline-audit.md',
  'docs/visual-qa-findings.md',
  'docs/devlog/2026-07-13-heterogeneous-classrooms.md',
  'server/test/e2e-legacy/README.md',
]);

const NORMATIVE_DOCS = [
  'docs/README.md',
  'docs/roadmap/master.md',
  'docs/interactive-curriculum/PRODUCTION-CONTRACT.md',
  'docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md',
];

function walk(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return relativePath.endsWith('.md') ? [normalize(relativePath)] : [];

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

const docs = [...new Set(HUMAN_DOC_ROOTS.flatMap(walk))].sort();
const registryPath = 'docs/README.md';
const registry = fs.readFileSync(path.resolve(root, registryPath), 'utf8');
const errors = [];
const warnings = [];

if (!docs.includes('README.md')) {
  errors.push('Root README.md was not discovered.');
}

if (!exists(registryPath)) {
  errors.push(`Missing documentation registry: ${registryPath}`);
}

// 1) Every human-authored Markdown document must be registered, except the
// root README (entry point) and the registry itself.
for (const doc of docs) {
  if (doc === 'README.md' || doc === registryPath) continue;

  const candidates = [
    doc,
    doc.startsWith('docs/') ? doc.slice('docs/'.length) : doc,
    path.basename(doc),
  ];

  if (!candidates.some((candidate) => registry.includes(candidate))) {
    errors.push(`Unregistered Markdown document: ${doc}`);
  }
}

// 2) Registry must not reference a classified local Markdown path that no
// longer exists. This intentionally ignores external links and prose.
const registryLinks = [...stripCodeFences(registry).matchAll(/\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/g)];
for (const [, rawTarget] of registryLinks) {
  const target = stripAnchorAndQuery(decodeTarget(rawTarget.trim()));
  if (!target || /^(https?:|mailto:)/i.test(target)) continue;
  const resolved = normalize(path.relative(root, path.resolve(root, path.dirname(registryPath), target)));
  if (!exists(resolved)) errors.push(`Registry link target does not exist: ${rawTarget}`);
}

// 3) Current documentation must not regress to known stale local setup
// patterns. Historical snapshots are intentionally preserved verbatim.
const stalePatterns = [
  { regex: /^#\s+EDUTO\b/im, label: 'legacy EDUTO document heading' },
  { regex: /\/Users\/[A-Za-z0-9._-]+\//, label: 'machine-local /Users/... path' },
  { regex: /POSTGRES_DB\s*=\s*eduto\b/i, label: 'legacy POSTGRES_DB=eduto example' },
  { regex: /JWT_SECRET\s*=\s*supersecret\b/i, label: 'demo JWT secret' },
];

for (const doc of docs) {
  if (HISTORICAL_DOCS.has(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');
  for (const { regex, label } of stalePatterns) {
    if (regex.test(content)) errors.push(`${doc}: contains ${label}`);
  }
}

// 4) Root identity and normative metadata are hard requirements.
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
  for (const field of ['Status', 'Owner']) {
    if (!new RegExp(`\\*\\*${field}:\\*\\*`, 'i').test(content)) {
      errors.push(`${doc}: missing required metadata field ${field}`);
    }
  }
  if (!/\*\*Last (verified|review):\*\*/i.test(content)) {
    errors.push(`${doc}: missing Last verified/review metadata`);
  }
}

// 5) Validate relative Markdown links in non-historical human docs. Historical
// snapshots may intentionally point at paths valid only at the captured time.
for (const doc of docs) {
  if (HISTORICAL_DOCS.has(doc)) continue;
  const content = stripCodeFences(fs.readFileSync(path.resolve(root, doc), 'utf8'));
  const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];

  for (const [, rawTarget] of links) {
    let target = rawTarget.trim();
    if (!target || target.startsWith('#') || /^(https?:|mailto:|tel:|data:)/i.test(target)) continue;

    // Markdown titles after a URL are out of scope for project-internal links.
    target = target.replace(/\s+["'][^"']*["']\s*$/, '');
    target = stripAnchorAndQuery(decodeTarget(target));
    if (!target) continue;

    const resolvedAbsolute = path.resolve(root, path.dirname(doc), target);
    if (!fs.existsSync(resolvedAbsolute)) {
      errors.push(`${doc}: broken relative link -> ${rawTarget}`);
    }
  }
}

// 6) Governance consistency: historical allowlist entries must exist and be
// explicitly classified by the registry.
for (const doc of HISTORICAL_DOCS) {
  if (!exists(doc)) {
    errors.push(`Historical allowlist references missing file: ${doc}`);
    continue;
  }
  const candidates = [doc, doc.startsWith('docs/') ? doc.slice(5) : doc, path.basename(doc)];
  if (!candidates.some((candidate) => registry.includes(candidate))) {
    errors.push(`Historical document is not classified in docs/README.md: ${doc}`);
  }
}

// Warnings are non-blocking but make incomplete governance visible.
for (const doc of docs) {
  if (doc === 'README.md' || HISTORICAL_DOCS.has(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');
  if (/\bTODO\b/i.test(content)) warnings.push(`${doc}: contains TODO; verify it is intentional and scoped.`);
}

console.log(`Documentation integrity: ${docs.length} human Markdown files scanned.`);
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
