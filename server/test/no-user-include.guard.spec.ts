import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', 'src');
const BANNED_PATTERN = /include\s*:\s*\{\s*user\s*:\s*true\s*\}/m;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('Security policy: never include full user entity', () => {
  it('disallows include: { user: true } in server/src', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const content = readFileSync(file, 'utf8');
      if (BANNED_PATTERN.test(content)) {
        offenders.push(file.replace(join(__dirname, '..') + '/', ''));
      }
    }
    expect(offenders).toEqual([]);
  });
});
