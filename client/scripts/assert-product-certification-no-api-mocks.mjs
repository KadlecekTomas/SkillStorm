import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const certificationFiles = [
  'backbone.scenario.ts',
  'concurrency.scenario.ts',
  'live-session.scenario.ts',
  'people-management.scenario.ts',
  'progress.scenario.ts',
  'release-surfaces.scenario.ts',
  'school-readiness.scenario.ts',
  'security.scenario.ts',
];

const forbidden = [
  { label: 'page/context route interception', pattern: /\b(?:page|context|browserContext)\.route\s*\(/ },
  { label: 'route.fulfill mock response', pattern: /\broute\.fulfill\s*\(/ },
  { label: 'HAR-based route mocking', pattern: /\brouteFromHAR\s*\(/ },
];

const root = join(process.cwd(), 'tests', 'scenarios');
const violations = [];

for (const file of certificationFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      violations.push(`${file}: ${rule.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error('\nPRODUCT CERTIFICATION REFUSED');
  console.error(
    'School product certification must cross the real SkillStorm HTTP boundary. ' +
      'Move mocked browser-contract coverage back to the normal scenario suite.',
  );
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log(
  `Product certification mock guard passed for ${certificationFiles.length} school-critical scenario files.`,
);
