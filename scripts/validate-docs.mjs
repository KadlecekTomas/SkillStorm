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

const SUBJECT_BLUEPRINT_STANDARD =
  'docs/interactive-curriculum/subjects/SUBJECT-BLUEPRINT-STANDARD.md';
const SUBJECT_BLUEPRINT_INDEX = 'docs/interactive-curriculum/subjects/README.md';
const SUBJECT_BLUEPRINTS = [
  'docs/interactive-curriculum/subjects/CZECH-LANGUAGE-LITERATURE.md',
  'docs/interactive-curriculum/subjects/ENGLISH.md',
  'docs/interactive-curriculum/subjects/ADDITIONAL-FOREIGN-LANGUAGE.md',
  'docs/interactive-curriculum/subjects/MATHEMATICS.md',
  'docs/interactive-curriculum/subjects/INFORMATICS.md',
  'docs/interactive-curriculum/subjects/HUMAN-AND-WORLD.md',
  'docs/interactive-curriculum/subjects/HISTORY.md',
  'docs/interactive-curriculum/subjects/CIVICS.md',
  'docs/interactive-curriculum/subjects/GEOGRAPHY.md',
  'docs/interactive-curriculum/subjects/PHYSICS.md',
  'docs/interactive-curriculum/subjects/CHEMISTRY.md',
  'docs/interactive-curriculum/subjects/BIOLOGY.md',
  'docs/interactive-curriculum/subjects/VISUAL-AND-FILM-EDUCATION.md',
  'docs/interactive-curriculum/subjects/MUSIC-DANCE-DRAMA.md',
  'docs/interactive-curriculum/subjects/HEALTH-AND-SAFETY.md',
  'docs/interactive-curriculum/subjects/PHYSICAL-EDUCATION.md',
  'docs/interactive-curriculum/subjects/PERSONAL-SOCIAL-EDUCATION.md',
  'docs/interactive-curriculum/subjects/POLYTECHNICS-PRACTICAL-ACTIVITIES.md',
];

const NORMATIVE_DOCS = [
  'docs/README.md',
  'docs/roadmap/master.md',
  'docs/interactive-curriculum/PRODUCTION-CONTRACT.md',
  'docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md',
  SUBJECT_BLUEPRINT_STANDARD,
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

function annotationSafe(value) {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
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

// 4) Active docs must not regress to known stale setup/identity patterns.
// Explicit historical provenance is allowed; using the legacy brand as an
// active document identity, setup example or runtime name is not.
const stalePatterns = [
  { regex: /^#\s+EDUTO\b/im, label: 'legacy product identity in document heading' },
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

// 8) Subject layer is a first-class coverage contract: exactly the 18 approved
// educational-field blueprints must exist, be indexed and meet the common spec.
const expectedSubjectBlueprints = new Set(SUBJECT_BLUEPRINTS);
const discoveredSubjectBlueprints = new Set(
  walk('docs/interactive-curriculum/subjects').filter(
    (doc) => doc !== SUBJECT_BLUEPRINT_INDEX && doc !== SUBJECT_BLUEPRINT_STANDARD,
  ),
);

if (SUBJECT_BLUEPRINTS.length !== 18) {
  errors.push(`Subject blueprint contract must list exactly 18 fields; got ${SUBJECT_BLUEPRINTS.length}.`);
}
if (new Set(SUBJECT_BLUEPRINTS).size !== SUBJECT_BLUEPRINTS.length) {
  errors.push('Subject blueprint contract contains duplicate paths.');
}

for (const doc of SUBJECT_BLUEPRINTS) {
  if (!exists(doc)) errors.push(`Missing required subject blueprint: ${doc}`);
  if (!registryDocTargets.has(doc)) errors.push(`Subject blueprint is not registered exactly: ${doc}`);
  if (!discoveredSubjectBlueprints.has(doc)) errors.push(`Subject blueprint not discovered in subject directory: ${doc}`);
}

for (const doc of discoveredSubjectBlueprints) {
  if (!expectedSubjectBlueprints.has(doc)) {
    errors.push(`Unclassified subject Markdown found in subjects directory: ${doc}`);
  }
}

if (!exists(SUBJECT_BLUEPRINT_INDEX)) {
  errors.push(`Missing subject blueprint index: ${SUBJECT_BLUEPRINT_INDEX}`);
} else {
  const subjectIndex = stripCodeFences(
    fs.readFileSync(path.resolve(root, SUBJECT_BLUEPRINT_INDEX), 'utf8'),
  );
  const subjectIndexLinks = [
    ...subjectIndex.matchAll(/\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/g),
  ];
  const subjectIndexTargets = new Set(
    subjectIndexLinks
      .map(([, rawTarget]) => resolveLocalTarget(SUBJECT_BLUEPRINT_INDEX, rawTarget))
      .filter(Boolean),
  );

  if (!subjectIndexTargets.has(SUBJECT_BLUEPRINT_STANDARD)) {
    errors.push('Subject index must link to SUBJECT-BLUEPRINT-STANDARD.md.');
  }
  for (const doc of SUBJECT_BLUEPRINTS) {
    if (!subjectIndexTargets.has(doc)) {
      errors.push(`Subject index is missing exact blueprint link: ${doc}`);
    }
  }
}

const requiredSubjectSections = [
  { regex: /##\s+\d+\.\s+Subject promise/i, label: 'Subject promise' },
  { regex: /Delivery modes/i, label: 'Delivery modes' },
  { regex: /Recommended progression/i, label: 'Recommended progression' },
  { regex: /Lesson archetypes/i, label: 'Lesson archetypes' },
  { regex: /Experience catalog/i, label: 'Experience catalog' },
  { regex: /Teacher (orchestration|Mission Control)/i, label: 'Teacher orchestration' },
  { regex: /Learning evidence/i, label: 'Learning evidence' },
  { regex: /Difficulty\s*[×x]\s*scaffolding/i, label: 'Difficulty × scaffolding' },
  { regex: /Accessibility\/SVP/i, label: 'Accessibility/SVP' },
  { regex: /Content authoring|Content\/data authoring|Content authoring and|Content authoring\/|Content authoring &|Content authoring and language packs|Content authoring and provenance/i, label: 'Content authoring' },
  { regex: /MVP vertical slice(?:s)?/i, label: 'MVP vertical slice' },
  { regex: /Non-goals/i, label: 'Non-goals' },
  { regex: /Production acceptance criteria/i, label: 'Production acceptance criteria' },
  { regex: /Pilot metrics/i, label: 'Pilot metrics' },
  { regex: /Content coverage workflow/i, label: 'Content coverage workflow' },
];

for (const doc of SUBJECT_BLUEPRINTS) {
  if (!exists(doc)) continue;
  const content = fs.readFileSync(path.resolve(root, doc), 'utf8');

  if (!/\*\*Status:\*\*\s*`VISION \/ APPROVED`/i.test(content)) {
    errors.push(`${doc}: subject blueprint must have Status VISION / APPROVED`);
  }
  if (!/\*\*Owner:\*\*/i.test(content)) {
    errors.push(`${doc}: subject blueprint is missing Owner metadata`);
  }
  if (content.length < 8000) {
    errors.push(`${doc}: subject blueprint is unexpectedly short (${content.length} chars)`);
  }

  const addressesNationalOutcomes = /RVP/i.test(content) || /OVU/i.test(content);
  const addressesSchoolCurriculum = /ŠVP/i.test(content);
  if (!addressesNationalOutcomes || !addressesSchoolCurriculum) {
    errors.push(`${doc}: subject blueprint must explicitly address national RVP/OVU and school ŠVP layers`);
  }

  if (!/BOARD_ONLY/.test(content)) {
    errors.push(`${doc}: subject blueprint must explicitly address BOARD_ONLY`);
  }

  for (const { regex, label } of requiredSubjectSections) {
    if (!regex.test(content)) errors.push(`${doc}: missing required subject section/concept: ${label}`);
  }

  const heroCount = (content.match(/Hero lesson\s+[A-Z0-9]/gi) || []).length;
  if (heroCount < 2) {
    errors.push(`${doc}: must contain at least two explicit Hero lessons; found ${heroCount}`);
  }
}

// 9) Deliberate TODO language is visible but non-blocking.
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
console.log(`Subject blueprints: ${SUBJECT_BLUEPRINTS.length}/18 required fields configured.`);

if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (errors.length > 0) {
  console.error(`Errors (${errors.length}):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
    console.error(`::error title=Documentation Integrity::${annotationSafe(error)}`);
  }
  process.exit(1);
}

console.log('Documentation integrity check passed.');