/**
 * Deprecation kill-switch: after ACTIVE_ALIAS_REMOVAL_DATE, this test fails until
 * all "active" aliases are removed. See docs/ACADEMIC_YEAR_TERMINOLOGY.md.
 *
 * This spec only reads source files and the deprecations module; it does not use
 * the database. (CI may still run the global jest-setup-after which requires DB.)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ACTIVE_ALIAS_REMOVAL_DATE,
  isActiveAliasRemovalDue,
} from '@/shared/deprecations';

const SERVER_SRC = path.join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SERVER_SRC, relativePath), 'utf-8');
}

describe('Active alias deprecation kill-switch', () => {
  beforeAll(() => {
    if (!isActiveAliasRemovalDue()) {
      // eslint-disable-next-line no-console
      console.info(
        `Active alias removal not yet due (${ACTIVE_ALIAS_REMOVAL_DATE}). Skipping enforcement.`,
      );
    }
  });

  it('after ACTIVE_ALIAS_REMOVAL_DATE, GET /academic-years/active route must be removed', () => {
    if (!isActiveAliasRemovalDue()) return;
    const controller = readSrc('academic-years/academic-years.controller.ts');
    const hasGetActive =
      /@Get\s*\(\s*['"]active['"]\s*\)/.test(controller) ||
      (controller.includes("'active'") && controller.includes('@Get'));
    expect(hasGetActive).toBe(false);
  });

  it('after ACTIVE_ALIAS_REMOVAL_DATE, deprecatedCode must not be emitted', () => {
    if (!isActiveAliasRemovalDue()) return;
    const service = readSrc('academic-years/academic-years.service.ts');
    const guard = readSrc('platform/application-readiness.guard.ts');
    expect(service).not.toMatch(/deprecatedCode/);
    expect(guard).not.toMatch(/deprecatedCode/);
  });

  it('after ACTIVE_ALIAS_REMOVAL_DATE, API DTO must not include hasActiveAcademicYear or hasAnyClassSectionInActiveYear', () => {
    if (!isActiveAliasRemovalDue()) return;
    const platform = readSrc('platform/platform.service.ts');
    expect(platform).not.toMatch(/\bhasActiveAcademicYear\b/);
    expect(platform).not.toMatch(/\bhasAnyClassSectionInActiveYear\b/);
  });

  it('after ACTIVE_ALIAS_REMOVAL_DATE, server must not export NO_ACTIVE_ACADEMIC_YEAR or MULTIPLE_ACTIVE_ACADEMIC_YEARS', () => {
    if (!isActiveAliasRemovalDue()) return;
    const service = readSrc('academic-years/academic-years.service.ts');
    const guard = readSrc('platform/application-readiness.guard.ts');
    // Service: no export or usage of the deprecated constant names (NO_ACTIVE_ACADEMIC_YEAR, MULTIPLE_ACTIVE_ACADEMIC_YEARS)
    expect(service).not.toMatch(/NO_ACTIVE_ACADEMIC_YEAR/);
    expect(service).not.toMatch(/MULTIPLE_ACTIVE_ACADEMIC_YEARS/);
    // Guard: READINESS_ERROR_CODES must not contain the deprecated keys
    expect(guard).not.toMatch(/NO_ACTIVE_ACADEMIC_YEAR\s*:/);
    expect(guard).not.toMatch(/MULTIPLE_ACTIVE_ACADEMIC_YEARS\s*:/);
  });
});
