import { SchoolGrade } from '@prisma/client';
import { parseClassGroup } from './class-group-parser';

describe('parseClassGroup', () => {
  it('detects "trida-7a@skola.cz" as 7.A with full confidence', () => {
    const r = parseClassGroup({ email: 'trida-7a@skola.cz', name: 'Třída 7.A' });
    expect(r.matched).toBe(true);
    expect(r.grade).toBe(SchoolGrade.GRADE_7);
    expect(r.section).toBe('A');
    expect(r.label).toBe('7.A');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects "7.a@skola.cz" as 7.A', () => {
    const r = parseClassGroup({ email: '7.a@skola.cz', name: '7.A' });
    expect(r.matched).toBe(true);
    expect(r.grade).toBe(SchoolGrade.GRADE_7);
    expect(r.section).toBe('A');
    expect(r.label).toBe('7.A');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects "zaci-8b@skola.cz" as 8.B', () => {
    const r = parseClassGroup({ email: 'zaci-8b@skola.cz', name: 'Žáci 8.B' });
    expect(r.matched).toBe(true);
    expect(r.grade).toBe(SchoolGrade.GRADE_8);
    expect(r.section).toBe('B');
    expect(r.label).toBe('8.B');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects from the name when the e-mail is opaque', () => {
    const r = parseClassGroup({
      email: 'class-2026-cohort@skola.cz',
      name: 'Třída 9.C',
    });
    expect(r.matched).toBe(true);
    expect(r.grade).toBe(SchoolGrade.GRADE_9);
    expect(r.section).toBe('C');
  });

  it('returns unmatched for a non-class group without throwing', () => {
    const r = parseClassGroup({
      email: 'lyzak-2026@skola.cz',
      name: 'Lyžařský kurz 2026',
    });
    expect(r.matched).toBe(false);
    expect(r.confidence).toBeLessThan(0.8);
  });

  it('returns low confidence for an ambiguous match', () => {
    const r = parseClassGroup({ email: 'projekt-7-skupina-a@skola.cz', name: '' });
    // Either no match or below threshold — never a confident class.
    if (r.matched) {
      expect(r.confidence).toBeLessThan(0.8);
    } else {
      expect(r.matched).toBe(false);
    }
  });
});
