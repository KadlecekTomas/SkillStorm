import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'docs', 'interactive-it-lab', 'YEAR-COVERAGE.md');
const OUTPUT = path.join(ROOT, 'server', 'content', 'informatics', 'year-pack.v1.json');
const WRITE = process.argv.includes('--write');

const CANONICAL = {
  ZV5: {
    '001': 'INF-INF-001-ZV5-001',
    '002': 'INF-INF-001-ZV5-002',
    '003': 'INF-INF-001-ZV5-003',
    '004': 'INF-INF-002-ZV5-004',
    '005': 'INF-INF-002-ZV5-005',
    '006': 'INF-INF-003-ZV5-006',
    '007': 'INF-INF-003-ZV5-007',
    '008': 'INF-INF-004-ZV5-008',
    '009': 'INF-INF-004-ZV5-009',
    '010': 'INF-INF-004-ZV5-010',
  },
  ZV9: {
    '001': 'INF-INF-001-ZV9-001',
    '002': 'INF-INF-001-ZV9-002',
    '003': 'INF-INF-001-ZV9-003',
    '004': 'INF-INF-001-ZV9-004',
    '005': 'INF-INF-002-ZV9-005',
    '006': 'INF-INF-002-ZV9-006',
    '007': 'INF-INF-002-ZV9-007',
    '008': 'INF-INF-002-ZV9-008',
    '009': 'INF-INF-003-ZV9-009',
    '010': 'INF-INF-003-ZV9-010',
    '011': 'INF-INF-003-ZV9-011',
    '012': 'INF-INF-004-ZV9-012',
    '013': 'INF-INF-004-ZV9-013',
    '014': 'INF-INF-004-ZV9-014',
  },
};

const EXPECTED_FAMILIES = [
  'DATA_DETECTIVE',
  'MODEL_LAB',
  'ALGORITHM_FACTORY',
  'BLOCK_PROGRAMMING',
  'DEBUG_LAB',
  'INFORMATION_SYSTEMS',
  'TABLE_DATA_LAB',
  'INSIDE_COMPUTER',
  'BUILD_A_PC',
  'NETWORK_BUILDER',
  'CYBER_DECISION',
  'ML_LAB',
  'TREND_EXPLAINER',
  'PROJECT_SPRINT',
  'PORTFOLIO_REVIEW',
];

function stripTicks(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('`') && trimmed.endsWith('`')
    ? trimmed.slice(1, -1)
    : trimmed;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripTicks(cell.trim()));
}

function expandOutcomeRef(raw) {
  const value = stripTicks(raw).trim();
  if (!value || value.toLowerCase() === 'bridge') return [];

  const all = value.match(/^ALL\s+(ZV5|ZV9)$/i);
  if (all) return Object.values(CANONICAL[all[1].toUpperCase()]);

  const matches = [...value.matchAll(/(ZV5|ZV9)-(\d{3}(?:\/\d{3})*)/gi)];
  if (matches.length === 0) {
    throw new Error(`Unsupported outcome reference: ${value}`);
  }

  const out = [];
  for (const match of matches) {
    const level = match[1].toUpperCase();
    for (const suffix of match[2].split('/')) {
      const canonical = CANONICAL[level][suffix];
      if (!canonical) throw new Error(`Unknown ${level} outcome suffix: ${suffix}`);
      out.push(canonical);
    }
  }
  return [...new Set(out)];
}

function parseFamilies(markdown) {
  const sectionStart = markdown.indexOf('# 3. Povinné lesson families');
  const sectionEnd = markdown.indexOf('\n---\n', sectionStart);
  if (sectionStart < 0 || sectionEnd < 0) throw new Error('Lesson family section not found');
  const section = markdown.slice(sectionStart, sectionEnd);
  return [...section.matchAll(/\| `([A-Z0-9_]+)` \|/g)].map((match) => match[1]);
}

function parseGrade(markdown, grade) {
  const heading = `# ${grade}. ${grade}. ročník`;
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`Grade ${grade} heading not found`);

  const nextHeading = grade < 9 ? `# ${grade + 1}. ${grade + 1}. ročník` : '# 10.';
  const next = markdown.indexOf(nextHeading, start + heading.length);
  const section = markdown.slice(start, next < 0 ? undefined : next);

  const standard = section.indexOf('STANDARD_32');
  if (standard < 0) throw new Error(`Grade ${grade} STANDARD_32 table not found`);
  const tail = section.slice(standard).split('\n');
  const headerIndex = tail.findIndex((line) => line.includes('| # |') && line.includes('Primární OVU'));
  if (headerIndex < 0) throw new Error(`Grade ${grade} lesson table header not found`);

  const lessons = [];
  for (const line of tail.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break;
    const cells = splitTableRow(line);
    if (cells.length !== 5) throw new Error(`Grade ${grade} malformed row: ${line}`);
    const order = Number(cells[0]);
    if (!Number.isInteger(order)) throw new Error(`Grade ${grade} invalid lesson number: ${cells[0]}`);
    lessons.push({
      id: `IT-G${grade}-L${String(order).padStart(2, '0')}`,
      grade,
      order,
      title: cells[1],
      experience: cells[2],
      requiredEvidence: cells[3],
      outcomeRef: cells[4],
      canonicalOutcomeCodes: expandOutcomeRef(cells[4]),
      coverageState: 'COVERED',
    });
  }

  if (lessons.length !== 32) {
    throw new Error(`Grade ${grade} must contain exactly 32 core lessons, found ${lessons.length}`);
  }
  lessons.forEach((lesson, index) => {
    if (lesson.order !== index + 1) throw new Error(`Grade ${grade} lesson sequence gap at ${lesson.id}`);
  });
  return lessons;
}

function buildManifest(markdown) {
  const families = parseFamilies(markdown);
  if (JSON.stringify(families) !== JSON.stringify(EXPECTED_FAMILIES)) {
    throw new Error(`Lesson-family registry drifted. Expected ${EXPECTED_FAMILIES.length}, found ${families.length}`);
  }

  const grades = [4, 5, 6, 7, 8, 9].map((grade) => ({
    grade,
    pacingProfiles: ['CORE_28', 'STANDARD_32', 'EXTENDED_36_PLUS'],
    lessons: parseGrade(markdown, grade),
  }));
  const lessons = grades.flatMap((grade) => grade.lessons);

  if (lessons.length !== 192) throw new Error(`Expected 192 core lessons, found ${lessons.length}`);
  if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) {
    throw new Error('Duplicate lesson IDs detected');
  }

  const referencedOutcomes = new Set(lessons.flatMap((lesson) => lesson.canonicalOutcomeCodes));
  const expectedOutcomes = new Set([...Object.values(CANONICAL.ZV5), ...Object.values(CANONICAL.ZV9)]);
  for (const outcome of expectedOutcomes) {
    if (!referencedOutcomes.has(outcome)) throw new Error(`Canonical outcome ${outcome} has no lesson mapping`);
  }

  return {
    schemaVersion: 1,
    packId: 'skillstorm-informatics-zs-4-9',
    sourceDocument: 'docs/interactive-it-lab/YEAR-COVERAGE.md',
    sourceStatus: 'VISION / APPROVED',
    curriculumScope: 'SkillStorm recommended progression; school ŠVP applicability remains authoritative',
    coverageSemantics: ['MISSING', 'PARTIAL', 'COVERED', 'VALIDATED'],
    lessonFamilies: families,
    canonicalOutcomes: CANONICAL,
    grades,
    totals: {
      grades: grades.length,
      coreLessons: lessons.length,
      zv5Outcomes: Object.keys(CANONICAL.ZV5).length,
      zv9Outcomes: Object.keys(CANONICAL.ZV9).length,
    },
  };
}

function referencedCount(value) {
  return value.grades.reduce(
    (sum, grade) => sum + grade.lessons.reduce((n, lesson) => n + lesson.canonicalOutcomeCodes.length, 0),
    0,
  );
}

const markdown = fs.readFileSync(SOURCE, 'utf8');
const manifest = buildManifest(markdown);
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (WRITE) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} with ${manifest.totals.coreLessons} lessons.`);
} else {
  console.log(
    `Informatics year pack source OK: ${manifest.totals.coreLessons} lessons, ${referencedCount(manifest)} canonical mappings.`,
  );
}
